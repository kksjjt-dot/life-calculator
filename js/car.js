/* 자동차 유지비 계산기 — 2026년 기준 (비영업용 승용차) */
(function (g) {
  var PREPAY_RATE = 0.05; // 2026년 연납 공제율 5%
  function floor10(n) { return Math.floor(n / 10) * 10; }

  // ── 1. 자동차세 ──
  // opt: { fuel:'ice'|'ev', cc, regYear, taxYear }
  function carTax(opt) {
    var perCc = 0, base;
    if (opt.fuel === 'ev') {
      base = 100000; // 전기·수소차 정액
    } else {
      perCc = opt.cc <= 1000 ? 80 : opt.cc <= 1600 ? 140 : 200;
      base = opt.cc * perCc;
    }
    var age = Math.max(1, opt.taxYear - opt.regYear + 1); // 차령
    // 3년차부터 매년 5%, 최대 50% (전기·수소차 정액세는 경감 없음)
    var cut = opt.fuel !== 'ev' && age >= 3 ? Math.min(0.5, (age - 2) * 0.05) : 0;
    var tax = floor10(base * (1 - cut));
    var edu = floor10(tax * 0.3); // 지방교육세 30%
    var total = tax + edu;
    return {
      perCc: perCc, base: base, age: age, cut: cut, tax: tax, edu: edu, total: total,
      half: Math.floor(total / 2),
      saveJan: floor10(total * PREPAY_RATE * 11 / 12) // 1월 연납: 2~12월분의 5%
    };
  }

  // ── 2. 연료비 ──
  function fuelCost(kmPerMonth, efficiency, price) {
    if (!efficiency) return { monthly: 0, yearly: 0, perKm: 0 };
    var perKm = price / efficiency;
    return { perKm: perKm, monthly: kmPerMonth * perKm, yearly: kmPerMonth * 12 * perKm };
  }

  // ── 3. 전기차 vs 내연기관 연간 비교 ──
  function compareEv(o) {
    var ice = fuelCost(o.km, o.iceEff, o.icePrice);
    var ev = fuelCost(o.km, o.evEff, o.evPrice);
    var iceTax = carTax({ fuel: 'ice', cc: o.cc, regYear: o.taxYear, taxYear: o.taxYear }).total;
    var evTax = carTax({ fuel: 'ev', cc: 0, regYear: o.taxYear, taxYear: o.taxYear }).total;
    var iceYear = ice.yearly + iceTax, evYear = ev.yearly + evTax;
    var diff = iceYear - evYear;
    return { ice: ice, ev: ev, iceTax: iceTax, evTax: evTax, iceYear: iceYear, evYear: evYear, diff: diff,
      breakEvenYears: o.priceGap > 0 && diff > 0 ? o.priceGap / diff : null };
  }

  var CAR = { carTax: carTax, fuelCost: fuelCost, compareEv: compareEv };
  g.CAR = CAR;
  if (typeof module !== 'undefined') module.exports = CAR;
  if (typeof document === 'undefined') return;

  var C = g.Calc;
  document.addEventListener('DOMContentLoaded', function () {
    var thisYear = new Date().getFullYear();
    var ySel = document.getElementById('ct-year');
    for (var y = thisYear + 1; y >= thisYear - 20; y--) {
      var o = document.createElement('option'); o.value = y; o.textContent = y + '년' + (y === thisYear - 20 ? ' 이전' : '');
      if (y === thisYear - 3) o.selected = true; ySel.appendChild(o);
    }
    function toggleFuel() { document.getElementById('ct-cc-wrap').style.display = g.radio('ct-fuel') === 'ev' ? 'none' : ''; }
    document.querySelectorAll('input[name="ct-fuel"]').forEach(function (el) { el.addEventListener('change', toggleFuel); });
    toggleFuel();

    document.getElementById('ct-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var fuel = g.radio('ct-fuel'), cc = C.num(g.val('ct-cc'));
      if (fuel === 'ice' && !cc) return g.showResult('ct-result', '<p class="error">배기량을 입력해 주세요.</p>');
      var r = carTax({ fuel: fuel, cc: cc, regYear: Number(ySel.value), taxYear: thisYear });
      var list = fuel === 'ev'
        ? [['기본 세액', '100,000원 (전기·수소차 정액)']]
        : [['기본 세액', C.comma(cc) + 'cc × ' + r.perCc + '원 = ' + C.won(r.base)]];
      list.push(['차령 / 경감률', r.age + '년차 / ' + (r.cut ? C.pct(r.cut, 0) + ' 경감' : '경감 없음')],
        ['자동차세', C.won(r.tax)], ['지방교육세 (30%)', C.won(r.edu)],
        ['6월·12월 각각', '약 ' + C.won(r.half)], ['1월 연납 시 절약', '약 ' + C.won(r.saveJan)]);
      g.showResult('ct-result', '<div class="sub">' + thisYear + '년 연간 자동차세 (교육세 포함)</div><div class="big">' + C.won(r.total) + '</div>' + g.rows(list) +
        '<p class="note">비영업용 승용차 기준입니다. 경차·장애인·다자녀 감면, 영업용·승합·화물차는 반영하지 않았습니다. 신규 등록 차량은 등록 월부터 일할 계산됩니다.</p>');
    });

    document.getElementById('fc-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var km = C.num(g.val('fc-km')), eff = C.num(g.val('fc-eff')), price = C.num(g.val('fc-price'));
      if (!km || !eff || !price) return g.showResult('fc-result', '<p class="error">모든 칸을 입력해 주세요.</p>');
      var r = fuelCost(km, eff, price);
      g.showResult('fc-result', '<div class="sub">한 달 예상 연료비</div><div class="big">' + C.won(r.monthly) + '</div>' +
        g.rows([['1km당 연료비', (Math.round(r.perKm * 10) / 10).toLocaleString('ko-KR') + '원'], ['한 달 주유량', (km / eff).toFixed(1) + 'L'], ['1년 연료비', C.won(r.yearly)]]));
    });

    document.getElementById('ev-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var o = { km: C.num(g.val('ev-km')), iceEff: C.num(g.val('ev-iceeff')), icePrice: C.num(g.val('ev-iceprice')), cc: C.num(g.val('ev-cc')),
        evEff: C.num(g.val('ev-eveff')), evPrice: C.num(g.val('ev-evprice')), priceGap: C.num(g.val('ev-gap')) * 1e4, taxYear: thisYear };
      if (!o.km || !o.iceEff || !o.evEff) return g.showResult('ev-result', '<p class="error">주행거리와 연비·전비를 입력해 주세요.</p>');
      var r = compareEv(o);
      var cheaper = r.diff >= 0 ? '전기차가 1년에' : '내연기관차가 1년에';
      var list = [['내연기관 연료비 + 자동차세', C.won(r.ice.yearly) + ' + ' + C.won(r.iceTax)],
        ['전기차 충전비 + 자동차세', C.won(r.ev.yearly) + ' + ' + C.won(r.evTax)],
        ['1km당 비용 (내연 / 전기)', Math.round(r.ice.perKm) + '원 / ' + Math.round(r.ev.perKm) + '원']];
      if (r.breakEvenYears) list.push(['차값 차이 회수 기간', '약 ' + r.breakEvenYears.toFixed(1) + '년']);
      g.showResult('ev-result', '<div class="sub">' + cheaper + '</div><div class="big">' + C.won(Math.abs(r.diff)) + ' 절약</div>' + g.rows(list) +
        '<p class="note">새 차 기준(차령 경감 없음)입니다. 보험료·정비비·보조금·충전 요금 변동은 반영하지 않았습니다.</p>');
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
