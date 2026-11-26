/* 육아 계산기 — 2026년 기준 */
(function (g) {
  var DAY = 86400000;
  function parse(s) { if (!s) return null; var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function diffDays(a, b) { // b - a (날짜 기준)
    return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY);
  }
  function fmt(d) {
    var w = '일월화수목금토'[d.getDay()];
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + w + ')';
  }

  // ── 1. 출산 예정일 (네겔레 법칙: 마지막 생리 시작일 + 280일, 주기 보정) ──
  function dueDate(lmp, cycle, today) {
    var adj = (cycle || 28) - 28;
    var start = addDays(lmp, adj);           // 보정된 임신 0주 0일
    var due = addDays(start, 280);
    var ga = diffDays(start, today);         // 오늘 기준 임신 일수
    return {
      due: due, dday: diffDays(today, due),
      weeks: Math.floor(ga / 7), days: ga % 7, gaDays: ga,
      conception: addDays(start, 14),
      tri2: addDays(start, 14 * 7),          // 임신 14주 0일
      tri3: addDays(start, 28 * 7),          // 임신 28주 0일
      full: addDays(start, 37 * 7)           // 만삭(37주)
    };
  }

  // ── 2. 아기 개월 수 / 기념일 (태어난 날 = 1일째) ──
  function babyAge(birth, today) {
    var days = diffDays(birth, today) + 1;
    var months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
    if (today.getDate() < birth.getDate()) months--;
    var mStart = new Date(birth.getFullYear(), birth.getMonth() + months, birth.getDate());
    var restDays = diffDays(mStart, today);
    var marks = [
      ['50일', addDays(birth, 49)], ['100일', addDays(birth, 99)], ['200일', addDays(birth, 199)],
      ['300일', addDays(birth, 299)], ['돌 (첫 생일)', new Date(birth.getFullYear() + 1, birth.getMonth(), birth.getDate())],
      ['500일', addDays(birth, 499)], ['두 돌', new Date(birth.getFullYear() + 2, birth.getMonth(), birth.getDate())],
      ['1000일', addDays(birth, 999)]
    ].map(function (m) { return { name: m[0], date: m[1], dday: diffDays(today, m[1]) }; });
    return { days: days, months: months, restDays: restDays, age: Math.floor(months / 12), marks: marks };
  }

  // ── 3. 육아휴직 급여 (2025년 개편, 2026년 유지) ──
  var MAN = 10000, FLOOR = 70 * MAN;
  var SIXSIX_CAP = [250, 250, 300, 350, 400, 450]; // 6+6 부모육아휴직제 1~6개월 상한(만원)
  function monthCap(m, sixsix) {
    if (sixsix && m <= 6) return { rate: 1, cap: SIXSIX_CAP[m - 1] * MAN };
    if (m <= 3) return { rate: 1, cap: 250 * MAN };
    if (m <= 6) return { rate: 1, cap: 200 * MAN };
    return { rate: 0.8, cap: 160 * MAN };
  }
  function parentalLeave(wage, months, sixsix) {
    var list = [], total = 0;
    for (var m = 1; m <= months; m++) {
      var c = monthCap(m, sixsix);
      var pay = Math.min(wage * c.rate, c.cap);
      pay = Math.max(pay, FLOOR);
      pay = Math.floor(pay);
      list.push({ m: m, rate: c.rate, cap: c.cap, pay: pay });
      total += pay;
    }
    return { list: list, total: total };
  }

  var BABY = { parse: parse, dueDate: dueDate, babyAge: babyAge, parentalLeave: parentalLeave, fmt: fmt };
  g.BABY = BABY;
  if (typeof module !== 'undefined') module.exports = BABY;
  if (typeof document === 'undefined') return;

  var C = g.Calc;
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function ddayText(n) { return n === 0 ? 'D-DAY' : n > 0 ? 'D-' + n : '지남'; }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('dd-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var lmp = parse(g.val('dd-lmp'));
      if (!lmp) return g.showResult('dd-result', '<p class="error">마지막 생리 시작일을 선택해 주세요.</p>');
      var r = dueDate(lmp, C.num(g.val('dd-cycle')) || 28, today());
      var now = r.gaDays < 0 ? '아직 임신 기간 전입니다' : r.gaDays > 300 ? '예정일이 이미 지났습니다' : '오늘은 임신 ' + r.weeks + '주 ' + r.days + '일';
      g.showResult('dd-result', '<div class="sub">출산 예정일</div><div class="big">' + fmt(r.due) + '</div>' +
        '<div class="sub">' + ddayText(r.dday) + ' · ' + now + '</div>' +
        g.rows([['예상 수정일(배란일)', fmt(r.conception)], ['임신 중기 시작 (14주)', fmt(r.tri2)], ['임신 후기 시작 (28주)', fmt(r.tri3)], ['만삭 (37주)', fmt(r.full)]]) +
        '<p class="note">마지막 생리 시작일 기준 추정치입니다. 실제 예정일은 초음파 검사로 병원에서 확정합니다.</p>');
    });

    document.getElementById('ba-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var b = parse(g.val('ba-birth'));
      if (!b) return g.showResult('ba-result', '<p class="error">아기 생일을 선택해 주세요.</p>');
      var t = today();
      if (b > t) return g.showResult('ba-result', '<p class="error">생일이 오늘 이후입니다.</p>');
      var r = babyAge(b, t);
      g.showResult('ba-result', '<div class="sub">오늘은 태어난 지</div><div class="big">' + C.comma(r.days) + '일째</div>' +
        '<div class="sub">생후 ' + r.months + '개월 ' + r.restDays + '일 · 만 ' + r.age + '세</div>' +
        g.rows(r.marks.map(function (m) { return [m.name, fmt(m.date) + ' · ' + ddayText(m.dday)]; })) +
        '<p class="note">태어난 날을 1일째로 세는 방식입니다. 예방접종 시기는 질병관리청 예방접종도우미에서 확인하세요.</p>');
    });

    document.getElementById('pl-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var wage = C.num(g.val('pl-wage')) * MAN, months = Number(g.val('pl-months')), six = g.checked('pl-sixsix');
      if (!wage) return g.showResult('pl-result', '<p class="error">월 통상임금을 입력해 주세요.</p>');
      var r = parentalLeave(wage, months, six);
      var rows = r.list.map(function (x) { return [x.m + '개월차 (' + (x.rate * 100) + '%, 상한 ' + x.cap / MAN + '만)', C.won(x.pay)]; });
      g.showResult('pl-result', '<div class="sub">' + months + '개월 동안 받는 육아휴직 급여 합계</div><div class="big">' + C.won(r.total) + '</div>' +
        '<div class="sub">' + C.korWon(r.total) + ' · 월평균 ' + C.won(r.total / months) + (six ? ' · 6+6 적용' : '') + '</div>' + g.rows(rows) +
        '<p class="note">고용보험 피보험 단위기간 180일 이상인 근로자 기준이며, 휴직 중 회사에서 받는 금품이 있으면 줄어들 수 있습니다. 정확한 금액은 고용24 모의계산에서 확인하세요.</p>');
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
