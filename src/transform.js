// serverless runtime (needs fetch() for the public ERE price feed)
// input = raw response from GET https://api.joulo.nl/functions/v1/api/energy
//   { total_kwh, total_ere_credits, total_sessions, months: [{ month: "YYYY-MM-01", kwh, ere_credits, sessions }] }
async function run(input) {
  const monthAbbr = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEC"];
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonthIdx = now.getUTCMonth() + 1; // 1-12
  const currentDayOfMonth = now.getUTCDate();

  const rawMonths = input && Array.isArray(input.months) ? input.months : [];
  const byMonth = {};
  for (const m of rawMonths) {
    const d = new Date(m.month);
    if (!isNaN(d) && d.getUTCFullYear() === currentYear) {
      byMonth[d.getUTCMonth() + 1] = m;
    }
  }

  // public feed, no auth needed: https://developer.joulo.nl/guides/ere-price-feed
  let erePriceMid = null;
  let erePriceWeek = null;
  let erePriceUpdatedAt = null;
  try {
    const res = await fetch("https://joulo.nl/api/ere-price");
    const priceData = await res.json();
    if (priceData && priceData.ok && priceData.current) {
      erePriceMid = priceData.current.mid_eur;
      erePriceWeek = priceData.current.week_number;
      erePriceUpdatedAt = priceData.current.updated_at;
    }
  } catch (e) {
    // feed unreachable: leave price fields null, kWh/ERE data still works
  }

  const daysInMonth = (year, monthIdx) => new Date(Date.UTC(year, monthIdx, 0)).getUTCDate();

  const months = [];
  const chartData = [];
  const chartDataEre = [];
  let totalKwhYtd = 0;
  let totalEreYtd = 0;
  let totalSessionsYtd = 0;
  let minMonth = null;
  let maxMonth = null;

  for (let i = 1; i <= 12; i++) {
    const src = byMonth[i];
    const kwh = src ? src.kwh : 0;
    const ereCredits = src ? src.ere_credits : 0;
    const sessions = src ? src.sessions : 0;
    const isFuture = i > currentMonthIdx;

    totalKwhYtd += kwh;
    totalEreYtd += ereCredits;
    totalSessionsYtd += sessions;

    const label = monthAbbr[i - 1];
    const kwhRounded = Math.round(kwh * 10) / 10;

    months.push({
      idx: i,
      label: label,
      kwh: kwhRounded,
      ere_credits: Math.round(ereCredits * 10) / 10,
      sessions: sessions,
      is_future: isFuture
    });

    if (!isFuture) {
      chartData.push([label, kwhRounded]);
      chartDataEre.push([label, Math.round(ereCredits * 10) / 10]);
      // only compare *complete* months for min/max — the current month is
      // partial and would almost always look artificially low
      if (i < currentMonthIdx) {
        if (!minMonth || kwh < minMonth.kwh) minMonth = { label: label, kwh: kwhRounded };
        if (!maxMonth || kwh > maxMonth.kwh) maxMonth = { label: label, kwh: kwhRounded };
      }
    }
  }

  // no complete months yet (e.g. it's January) — fall back to the current month
  if (!minMonth && months[currentMonthIdx - 1] && !months[currentMonthIdx - 1].is_future) {
    const cur = months[currentMonthIdx - 1];
    minMonth = { label: cur.label, kwh: cur.kwh };
    maxMonth = { label: cur.label, kwh: cur.kwh };
  }

  // pace this month (partial) vs the average daily pace of prior complete months,
  // rather than comparing a partial month's total to a full month's total
  let trend = "eq";
  const currentSrc = byMonth[currentMonthIdx];
  if (currentSrc && currentDayOfMonth > 0) {
    const dailyRateCurrent = currentSrc.kwh / currentDayOfMonth;
    const priorMonths = months.filter(m => m.idx < currentMonthIdx && m.kwh > 0);
    if (priorMonths.length > 0) {
      const priorDailyRates = priorMonths.map(m => m.kwh / daysInMonth(currentYear, m.idx));
      const avgPriorDailyRate = priorDailyRates.reduce((a, b) => a + b, 0) / priorDailyRates.length;
      if (dailyRateCurrent > avgPriorDailyRate * 1.1) trend = "up";
      else if (dailyRateCurrent < avgPriorDailyRate * 0.9) trend = "down";
    }
  }

  const totalValueEurYtd = erePriceMid !== null ? Math.round(totalEreYtd * erePriceMid * 100) / 100 : null;
  const avgKwhMonth = currentMonthIdx > 0 ? Math.round((totalKwhYtd / currentMonthIdx) * 10) / 10 : 0;

  return {
    year: currentYear,
    current_month_label: monthAbbr[currentMonthIdx - 1],
    months: months,
    chart_data: chartData,
    chart_data_ere: chartDataEre,
    min_month: minMonth,
    max_month: maxMonth,
    trend: trend,
    total_kwh_ytd: Math.round(totalKwhYtd * 10) / 10,
    total_ere_credits_ytd: Math.round(totalEreYtd * 10) / 10,
    total_sessions_ytd: totalSessionsYtd,
    total_value_eur_ytd: totalValueEurYtd,
    avg_kwh_month: avgKwhMonth,
    ere_price_mid: erePriceMid,
    ere_price_week: erePriceWeek,
    ere_price_updated_at: erePriceUpdatedAt
  };
}
