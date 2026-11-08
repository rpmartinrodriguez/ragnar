// Cálculo de renovación mensual a partir de startDate (día base de cobro).
// Los meses cortos usan el último día. No cambia payments/{YYYY-MM}.
export const RAGNAR_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export function ymdInArgentina(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: RAGNAR_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return [value.year,value.month,value.day].join('-');
}
export function validYmd(ymd) {
  if(typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y,m,d]=ymd.split('-').map(Number);
  return m>=1 && m<=12 && d>=1 && d<=31 &&
    new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)===ymd;
}
function dayInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function addMonthlyRenewal(year, month, baseDay) {
  const day=Math.min(baseDay,dayInMonth(year,month));
  return [year,String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
}
export function getUpcomingRenewal(startDate, todayYmd=ymdInArgentina()) {
  if(!validYmd(startDate)||!validYmd(todayYmd)) return null;
  const [sy,sm,sd]=startDate.split('-').map(Number);
  const [ty,tm]=todayYmd.split('-').map(Number);
  let year=ty,month=tm;
  if(startDate>todayYmd){year=sy;month=sm;}
  let due=addMonthlyRenewal(year,month,sd);
  if(due<startDate)due=startDate;
  if(due<todayYmd){
    month++;
    if(month===13){month=1;year++;}
    due=addMonthlyRenewal(year,month,sd);
  }
  const daysUntil=Math.round((Date.parse(due+'T00:00:00Z')-
    Date.parse(todayYmd+'T00:00:00Z'))/86400000);
  return {dueYmd:due,periodId:due.slice(0,7),daysUntil};
}
export function renewalReminderDate(startDate, todayYmd=ymdInArgentina()) {
  const next=getUpcomingRenewal(startDate,todayYmd);
  return next && next.daysUntil===3 ? next : null;
}
