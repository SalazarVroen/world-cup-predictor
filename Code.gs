/**
 * World Cup Predictor — Google Sheets backend (Apps Script Web App)
 * =================================================================
 * This turns your Google Sheet into the shared database so the leaderboard
 * works across ALL players (a plain API key can only READ — this can write).
 *
 * SETUP (5 minutes):
 *  1. Open your Google Sheet:
 *     https://docs.google.com/spreadsheets/d/1OjR95jTkuDG6ya1MEkhey_cFAfEWDq4VMlJ8C8tUcKw/edit
 *  2. Extensions → Apps Script. Delete everything, paste this whole file.
 *  3. Click Save (disk icon).
 *  4. Click Deploy → New deployment → type "Web app".
 *       - Execute as: Me
 *       - Who has access: Anyone
 *     Click Deploy, authorize when asked, COPY the Web app URL.
 *  5. Paste that URL into index.html → CONFIG.BACKEND_URL, redeploy the site.
 *
 * The sheet tabs (Users / Predictions / Results / Leaderboard) are created
 * automatically on first call — you don't have to set them up by hand.
 */

var ROUND_POINTS = { R32:1, R16:2, QF:3, SF:5, FN:8 };
function pointsForMatch(id){
  id = Number(id);
  if (id <= 16) return ROUND_POINTS.R32;
  if (id <= 24) return ROUND_POINTS.R16;
  if (id <= 28) return ROUND_POINTS.QF;
  if (id <= 30) return ROUND_POINTS.SF;
  return ROUND_POINTS.FN; // 31
}

function doPost(e){
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    var fn = {
      register:    register,
      load:        load,
      savePicks:   savePicks,
      saveResults: saveResults,
      recalculate: recalculate,
      leaderboard: leaderboard,
      matchStats:  matchStats
    }[req.action];
    out = fn ? fn(req) : { error: 'unknown action: ' + req.action };
  } catch (err) {
    out = { error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(){
  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, service: 'World Cup Predictor backend' })
  ).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- sheet helpers ---------- */
function ss(){ return SpreadsheetApp.getActiveSpreadsheet(); }
function sheet(nameStr, headers){
  var s = ss().getSheetByName(nameStr);
  if (!s){ s = ss().insertSheet(nameStr); s.appendRow(headers); }
  else if (s.getLastRow() === 0){ s.appendRow(headers); }
  return s;
}
function rows(s){
  var v = s.getDataRange().getValues();
  return v.length > 1 ? v.slice(1) : [];
}

/* ---------- actions ---------- */
function register(req){
  var s = sheet('Users', ['Email','Name','Points','Correct']);
  var data = rows(s), found = false;
  for (var i = 0; i < data.length; i++){
    if (String(data[i][0]).toLowerCase() === req.email.toLowerCase()){ found = true; break; }
  }
  if (!found) s.appendRow([req.email, req.name || req.email, 0, 0]);
  return { ok: true };
}

function load(req){
  var preds = rows(sheet('Predictions', ['Email','MatchID','Pick']));
  var picks = {};
  preds.forEach(function(r){
    if (String(r[0]).toLowerCase() === req.email.toLowerCase()) picks[r[1]] = r[2];
  });
  var res = {};
  rows(sheet('Results', ['MatchID','Winner'])).forEach(function(r){
    if (r[0] !== '' && r[1] !== '') res[r[0]] = r[1];
  });
  return { picks: picks, results: res };
}

function savePicks(req){
  var s = sheet('Predictions', ['Email','MatchID','Pick']);
  var all = s.getDataRange().getValues();
  // keep header + everyone else's rows, drop this user's old rows
  var keep = [all[0]];
  for (var i = 1; i < all.length; i++){
    if (String(all[i][0]).toLowerCase() !== req.email.toLowerCase()) keep.push(all[i]);
  }
  Object.keys(req.picks || {}).forEach(function(mid){
    keep.push([req.email, mid, req.picks[mid]]);
  });
  s.clearContents();
  s.getRange(1, 1, keep.length, 3).setValues(keep);
  return { ok: true };
}

function saveResults(req){
  var s = sheet('Results', ['MatchID','Winner']);
  var out = [['MatchID','Winner']];
  Object.keys(req.results || {}).forEach(function(mid){
    out.push([mid, req.results[mid]]);
  });
  s.clearContents();
  s.getRange(1, 1, out.length, 2).setValues(out);
  return { ok: true };
}

function recalculate(){
  var results = {};
  rows(sheet('Results', ['MatchID','Winner'])).forEach(function(r){
    if (r[0] !== '' && r[1] !== '') results[r[0]] = r[1];
  });

  // tally per email
  var tally = {}; // email -> {correct, points}
  rows(sheet('Predictions', ['Email','MatchID','Pick'])).forEach(function(r){
    var email = r[0], mid = r[1], pick = r[2];
    if (results[mid] !== undefined && results[mid] === pick){
      if (!tally[email]) tally[email] = { correct: 0, points: 0 };
      tally[email].correct += 1;
      tally[email].points  += pointsForMatch(mid);
    }
  });

  // write back to Users
  var s = sheet('Users', ['Email','Name','Points','Correct']);
  var data = s.getDataRange().getValues();
  for (var i = 1; i < data.length; i++){
    var email = data[i][0];
    var t = tally[email] || { correct: 0, points: 0 };
    data[i][2] = t.points;
    data[i][3] = t.correct;
  }
  if (data.length > 1) s.getRange(1, 1, data.length, 4).setValues(data);

  buildLeaderboardSheet();
  return { users: data.length - 1 };
}

function leaderboard(){
  var results = {};
  rows(sheet('Results', ['MatchID','Winner'])).forEach(function(r){
    if (r[0] !== '' && r[1] !== '') results[String(r[0])] = r[1];
  });
  var decided = {}, champPicks = {};
  rows(sheet('Predictions', ['Email','MatchID','Pick'])).forEach(function(r){
    var email = String(r[0]).toLowerCase(), mid = String(r[1]), pick = String(r[2]);
    if (results[mid] !== undefined) decided[email] = (decided[email]||0)+1;
    if (mid === '31' && pick && pick !== '' && pick !== 'undefined') {
      champPicks[pick] = (champPicks[pick]||0)+1;
    }
  });
  var out = [];
  rows(sheet('Users', ['Email','Name','Points','Correct'])).forEach(function(r){
    var email = String(r[0]).toLowerCase();
    out.push({ email: r[0], name: r[1] || r[0],
               points: Number(r[2]) || 0, correct: Number(r[3]) || 0,
               pickedDecided: decided[email] || 0 });
  });
  out.sort(function(a,b){ return b.points - a.points || b.correct - a.correct; });
  return { rows: out, champPicks: champPicks };
}

function matchStats(){
  var stats = {};
  rows(sheet('Predictions', ['Email','MatchID','Pick'])).forEach(function(r){
    var mid = String(r[1]), pick = String(r[2]);
    if (!mid || !pick || pick === '' || pick === 'undefined') return;
    if (!stats[mid]) stats[mid] = { picks: {}, total: 0 };
    stats[mid].picks[pick] = (stats[mid].picks[pick] || 0) + 1;
    stats[mid].total++;
  });
  return { stats: stats };
}

function buildLeaderboardSheet(){
  var s = sheet('Leaderboard', ['Rank','Name','Email','Correct','Points','Medal']);
  s.clearContents();
  var lb = leaderboard().rows;
  var data = [['Rank','Name','Email','Correct','Points','Medal']];
  var rank = 0, prevP = null, prevC = null, seen = 0;
  lb.forEach(function(r){
    seen++;
    if (r.points !== prevP || r.correct !== prevC){ rank = seen; prevP = r.points; prevC = r.correct; }
    var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
    data.push([rank, r.name, r.email, r.correct, r.points, medal]);
  });
  if (data.length > 1) s.getRange(1, 1, data.length, 6).setValues(data);
}
