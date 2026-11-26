/* 생활계산기 공통 함수 */
(function (g) {
  // "1,234,000" → 1234000
  function num(v) {
    if (typeof v === 'number') return v;
    var n = parseFloat(String(v || '').replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  // 1234567 → "1,234,567"
  function comma(n) {
    return Math.round(n).toLocaleString('ko-KR');
  }
  function won(n) { return comma(n) + '원'; }
  // 325000000 → "3억 2,500만원"
  function korWon(n) {
    n = Math.round(n);
    if (n === 0) return '0원';
    var neg = n < 0; n = Math.abs(n);
    var eok = Math.floor(n / 1e8), man = Math.floor((n % 1e8) / 1e4), rest = n % 1e4;
    var s = [];
    if (eok) s.push(comma(eok) + '억');
    if (man) s.push(comma(man) + '만');
    if (rest && !eok) s.push(comma(rest));
    return (neg ? '-' : '') + s.join(' ') + '원';
  }
  function pct(x, d) { return (x * 100).toFixed(d == null ? 2 : d).replace(/\.?0+$/, '') + '%'; }

  g.Calc = { num: num, comma: comma, won: won, korWon: korWon, pct: pct };

  if (typeof document === 'undefined') return;

  // 금액 입력칸 자동 콤마 + 한글 금액 힌트
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el.matches || !el.matches('input[data-money]')) return;
    var raw = el.value.replace(/[^0-9]/g, '');
    el.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
    var hint = document.getElementById(el.id + '-hint');
    if (hint) {
      var mult = Number(el.dataset.money) || 1; // data-money="10000" 이면 만원 단위
      hint.textContent = raw ? korWon(Number(raw) * mult) : '';
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    // 초기값 힌트 채우기
    document.querySelectorAll('input[data-money]').forEach(function (el) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // 맨 위로 버튼
    var top = document.querySelector('.top-btn');
    if (top) {
      window.addEventListener('scroll', function () { top.classList.toggle('show', window.scrollY > 600); });
      top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    }
  });

  // 결과 박스 출력
  g.showResult = function (id, html) {
    var box = document.getElementById(id);
    box.innerHTML = html;
    box.classList.add('show');
  };
  g.rows = function (list) {
    return '<table>' + list.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</table>';
  };
  g.val = function (id) { return document.getElementById(id).value; };
  g.radio = function (name) { var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : null; };
  g.checked = function (id) { return document.getElementById(id).checked; };
})(typeof window !== 'undefined' ? window : globalThis);
