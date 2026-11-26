/* 부동산 계산기 — 2026년 기준 */
(function (g) {
  var EOK = 1e8, MAN = 1e4;
  function floor10(n) { return Math.floor(n / 10) * 10; } // 10원 미만 절사

  // ── 1. 취득세 (유상 매매 취득) ──
  // opt: { price, kind:'house'|'other', homes:1|2|3|4, adjusted:bool, over85:bool, firstHome:bool }
  function acquisitionTax(opt) {
    var P = opt.price;
    var acq, edu, rural, rate, heavy = false, label;
    if (opt.kind === 'other') {
      // 오피스텔·상가·토지 등 주택 외 부동산
      rate = 0.04; acq = P * 0.04; edu = P * 0.004; rural = P * 0.002;
      label = '주택 외 부동산 일반세율 4%';
    } else {
      var h = opt.homes;
      if (h >= 4 || (h === 3 && opt.adjusted)) { rate = 0.12; heavy = true; }
      else if (h === 3 || (h === 2 && opt.adjusted)) { rate = 0.08; heavy = true; }
      if (heavy) {
        acq = P * rate;
        edu = P * 0.004;
        rural = opt.over85 ? P * (rate === 0.12 ? 0.01 : 0.006) : 0;
        label = '다주택 중과세율 ' + (rate * 100) + '%';
      } else {
        if (P <= 6 * EOK) rate = 0.01;
        else if (P <= 9 * EOK) rate = Math.round(((P / EOK) * 2 / 3 - 3) / 100 * 1e5) / 1e5; // 소수점 다섯째 자리
        else rate = 0.03;
        acq = P * rate;
        edu = acq * 0.1;
        rural = opt.over85 ? P * 0.002 : 0;
        label = '주택 기본세율 ' + (Math.round(rate * 1e4) / 100) + '%';
      }
    }
    var discount = 0;
    if (opt.kind === 'house' && opt.firstHome && opt.homes === 1 && P <= 12 * EOK) {
      discount = Math.min(acq, 200 * MAN);
    }
    acq = floor10(acq); edu = floor10(edu); rural = floor10(rural); discount = floor10(discount);
    var total = acq - discount + edu + rural;
    return { rate: rate, heavy: heavy, label: label, acq: acq, discount: discount, edu: edu, rural: rural, total: total };
  }

  // ── 2. 중개수수료(중개보수) 상한 ──
  var HOUSE_SALE = [ // [미만 금액, 요율, 한도]
    [5000 * MAN, 0.006, 250000], [2 * EOK, 0.005, 800000], [9 * EOK, 0.004, null],
    [12 * EOK, 0.005, null], [15 * EOK, 0.006, null], [Infinity, 0.007, null]];
  var HOUSE_LEASE = [
    [5000 * MAN, 0.005, 200000], [1 * EOK, 0.004, 300000], [6 * EOK, 0.003, null],
    [12 * EOK, 0.004, null], [15 * EOK, 0.005, null], [Infinity, 0.006, null]];

  // opt: { deal:'sale'|'jeonse'|'monthly', kind:'house'|'officetel'|'other', price, deposit, rent }
  function brokerage(opt) {
    var base;
    if (opt.deal === 'sale') base = opt.price;
    else if (opt.deal === 'jeonse') base = opt.deposit;
    else {
      base = opt.deposit + opt.rent * 100;
      if (base < 5000 * MAN) base = opt.deposit + opt.rent * 70;
    }
    var rate, cap = null;
    if (opt.kind === 'house') {
      var table = opt.deal === 'sale' ? HOUSE_SALE : HOUSE_LEASE;
      for (var i = 0; i < table.length; i++) {
        if (base < table[i][0]) { rate = table[i][1]; cap = table[i][2]; break; }
      }
    } else if (opt.kind === 'officetel') {
      rate = opt.deal === 'sale' ? 0.005 : 0.004; // 전용 85㎡ 이하 + 부엌·화장실 등 요건
    } else {
      rate = 0.009; // 그 밖의 부동산: 0.9% 이내 협의
    }
    var fee = base * rate;
    var capped = false;
    if (cap != null && fee > cap) { fee = cap; capped = true; }
    fee = Math.floor(fee);
    return { base: base, rate: rate, cap: cap, capped: capped, fee: fee, vat: Math.floor(fee * 0.1), withVat: fee + Math.floor(fee * 0.1) };
  }

  // ── 3. 전월세 전환 ──
  // 법정 전환율 상한 = min(10%, 기준금리 + 2%p)
  function legalRate(baseRate) { return Math.min(0.10, baseRate + 0.02); }
  // 전세 → 월세: 보증금 일부를 월세로
  function jeonseToMonthly(jeonse, newDeposit, rate) {
    var diff = Math.max(0, jeonse - newDeposit);
    return { diff: diff, rent: Math.round(diff * rate / 12) };
  }
  // 월세 → 보증금: 월세를 보증금으로 환산
  function monthlyToDeposit(deposit, rent, rate) {
    var add = rate > 0 ? rent * 12 / rate : 0;
    return { add: Math.round(add), jeonse: Math.round(deposit + add) };
  }

  // ── 4. 대출 이자 ──
  // method: 'annuity'(원리금균등) | 'principal'(원금균등) | 'bullet'(만기일시)
  function loan(principal, annualRate, months, method) {
    var r = annualRate / 12, schedule = [], bal = principal, totalInt = 0, i, pay, int, prin;
    for (i = 1; i <= months; i++) {
      int = bal * r;
      if (method === 'annuity') {
        pay = r === 0 ? principal / months : principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
        prin = pay - int;
      } else if (method === 'principal') {
        prin = principal / months; pay = prin + int;
      } else {
        prin = i === months ? principal : 0; pay = prin + int;
      }
      bal -= prin; totalInt += int;
      schedule.push({ n: i, pay: pay, prin: prin, int: int, bal: Math.max(0, bal) });
    }
    return { first: schedule[0], last: schedule[schedule.length - 1], totalInt: totalInt, total: principal + totalInt, schedule: schedule };
  }

  var RE = { acquisitionTax: acquisitionTax, brokerage: brokerage, legalRate: legalRate, jeonseToMonthly: jeonseToMonthly, monthlyToDeposit: monthlyToDeposit, loan: loan };
  g.RE = RE;
  if (typeof module !== 'undefined') module.exports = RE;
  if (typeof document === 'undefined') return;

  // ───────── 화면 연결 ─────────
  var C = g.Calc;
  function money(id) { return C.num(g.val(id)) * MAN; } // 만원 단위 입력 → 원

  document.addEventListener('DOMContentLoaded', function () {
    // 취득세: 주택 외 선택 시 주택 옵션 숨김
    var kindSel = document.getElementById('acq-kind');
    function toggleKind() { document.getElementById('acq-house-opts').style.display = kindSel.value === 'house' ? '' : 'none'; }
    kindSel.addEventListener('change', toggleKind); toggleKind();

    document.getElementById('acq-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var price = money('acq-price');
      if (!price) return g.showResult('acq-result', '<p class="error">취득가액을 입력해 주세요.</p>');
      var r = acquisitionTax({
        price: price, kind: kindSel.value, homes: Number(g.val('acq-homes')),
        adjusted: g.checked('acq-adjusted'), over85: g.checked('acq-over85'), firstHome: g.checked('acq-first')
      });
      var list = [['적용 세율', r.label], ['취득세', C.won(r.acq)]];
      if (r.discount) list.push(['생애최초 감면', '- ' + C.won(r.discount)]);
      list.push(['지방교육세', C.won(r.edu)], ['농어촌특별세', r.rural ? C.won(r.rural) : '비과세 (전용 85㎡ 이하)']);
      g.showResult('acq-result',
        '<div class="sub">예상 납부 세금 합계</div><div class="big">' + C.won(r.total) + '</div>' +
        '<div class="sub">' + C.korWon(r.total) + ' · 취득가액 대비 ' + C.pct(r.total / price) + '</div>' + g.rows(list) +
        '<p class="note">취득일(잔금일)로부터 60일 안에 신고·납부해야 합니다. 일시적 2주택, 공시가격 1억 원 이하 주택, 감면 시 부가세 등 예외는 반영하지 않았으니 정확한 금액은 위택스에서 확인하세요.</p>');
    });

    // 중개수수료
    function dealType() { return g.radio('bk-deal'); }
    function toggleDeal() {
      var d = dealType();
      document.getElementById('bk-price-wrap').style.display = d === 'sale' ? '' : 'none';
      document.getElementById('bk-deposit-wrap').style.display = d === 'sale' ? 'none' : '';
      document.getElementById('bk-rent-wrap').style.display = d === 'monthly' ? '' : 'none';
    }
    document.querySelectorAll('input[name="bk-deal"]').forEach(function (el) { el.addEventListener('change', toggleDeal); });
    toggleDeal();
    document.getElementById('bk-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var r = brokerage({ deal: dealType(), kind: g.val('bk-kind'), price: money('bk-price'), deposit: money('bk-deposit'), rent: money('bk-rent') });
      if (!r.base) return g.showResult('bk-result', '<p class="error">거래금액을 입력해 주세요.</p>');
      g.showResult('bk-result',
        '<div class="sub">법정 상한 중개보수 (부가세 별도)</div><div class="big">' + C.won(r.fee) + '</div>' +
        '<div class="sub">부가세 10% 포함 시 ' + C.won(r.withVat) + '</div>' +
        g.rows([['거래금액(환산)', C.won(r.base)], ['상한요율', C.pct(r.rate, 2) + (g.val('bk-kind') === 'other' ? ' 이내 협의' : '')],
          ['한도액', r.cap ? C.won(r.cap) + (r.capped ? ' (한도 적용)' : '') : '없음']]) +
        '<p class="note">상한 금액이며 중개사와 협의해 낮출 수 있습니다. 매도인·매수인(임대인·임차인)이 각각 냅니다. 간이과세 중개사무소는 부가세가 10%보다 낮을 수 있습니다.</p>');
    });

    // 전월세 전환
    document.getElementById('cv-base').addEventListener('input', function () {
      document.getElementById('cv-rate').value = (legalRate(C.num(this.value) / 100) * 100).toFixed(2).replace(/\.?0+$/, '');
    });
    function cvMode() { return g.radio('cv-mode'); }
    function toggleCv() {
      var m = cvMode();
      document.getElementById('cv-j2m').style.display = m === 'j2m' ? '' : 'none';
      document.getElementById('cv-m2j').style.display = m === 'm2j' ? '' : 'none';
    }
    document.querySelectorAll('input[name="cv-mode"]').forEach(function (el) { el.addEventListener('change', toggleCv); });
    toggleCv();
    document.getElementById('cv-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var rate = C.num(g.val('cv-rate')) / 100;
      if (!rate) return g.showResult('cv-result', '<p class="error">전환율을 입력해 주세요.</p>');
      if (cvMode() === 'j2m') {
        var j = money('cv-jeonse'), d = money('cv-newdep');
        if (!j) return g.showResult('cv-result', '<p class="error">현재 전세보증금을 입력해 주세요.</p>');
        if (d > j) return g.showResult('cv-result', '<p class="error">바꿀 보증금이 전세보증금보다 큽니다.</p>');
        var r = jeonseToMonthly(j, d, rate);
        g.showResult('cv-result', '<div class="sub">보증금 ' + C.korWon(d) + '일 때 월세</div><div class="big">월 ' + C.won(r.rent) + '</div>' +
          g.rows([['월세로 바뀌는 보증금', C.won(r.diff)], ['적용 전환율', C.pct(rate)], ['연간 월세 합계', C.won(r.rent * 12)]]) +
          '<p class="note">계약 기간 중 전세를 월세로 바꿀 때 법정 상한 기준입니다. 새 계약은 시장 시세에 따라 자유롭게 정해집니다.</p>');
      } else {
        var dep = money('cv-dep'), rent = money('cv-rentval');
        if (!rent) return g.showResult('cv-result', '<p class="error">월세를 입력해 주세요.</p>');
        var r2 = monthlyToDeposit(dep, rent, rate);
        g.showResult('cv-result', '<div class="sub">같은 조건의 전세 환산 보증금</div><div class="big">' + C.korWon(r2.jeonse) + '</div>' +
          g.rows([['현재 보증금', C.won(dep)], ['월세를 보증금으로 환산', C.won(r2.add)], ['적용 전환율', C.pct(rate)]]));
      }
    });

    // 대출 이자
    document.getElementById('ln-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var P = money('ln-amount'), rate = C.num(g.val('ln-rate')) / 100, years = C.num(g.val('ln-years'));
      var months = Math.round(years * 12), method = g.val('ln-method');
      if (!P || !months) return g.showResult('ln-result', '<p class="error">대출금액과 기간을 입력해 주세요.</p>');
      var r = loan(P, rate, months, method);
      var head = method === 'annuity' ? '매달 내는 금액' : '첫 달 내는 금액';
      var list = [['총 이자', C.won(r.totalInt)], ['총 상환액', C.won(r.total)]];
      if (method === 'principal') list.unshift(['마지막 달 금액', C.won(r.last.pay)]);
      if (method === 'bullet') list.unshift(['만기 달 금액 (원금 포함)', C.won(r.last.pay)]);
      var sched = r.schedule.filter(function (s) { return s.n <= 12 || s.n % 12 === 0 || s.n === months; });
      var tbl = '<details><summary>상환 스케줄 보기 (1년차 매월 + 이후 연말)</summary><table><tr><td><b>회차</b></td><td><b>납입액 / 이자 / 잔액</b></td></tr>' +
        sched.map(function (s) { return '<tr><td>' + s.n + '회</td><td>' + C.comma(s.pay) + ' / ' + C.comma(s.int) + ' / ' + C.comma(s.bal) + '</td></tr>'; }).join('') + '</table></details>';
      g.showResult('ln-result', '<div class="sub">' + head + '</div><div class="big">' + C.won(r.first.pay) + '</div>' +
        '<div class="sub">첫 달 이자 ' + C.won(r.first.int) + '</div>' + g.rows(list) + tbl +
        '<p class="note">고정금리 가정 계산입니다. 변동금리·거치기간·중도상환수수료는 반영되지 않습니다.</p>');
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
