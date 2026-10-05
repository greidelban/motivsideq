// Primo giorno della settimana nella lingua: 1 = lunedì … 7 = domenica
// (Intl.Locale.weekInfo; dove il browser non lo sa, lunedì).
export function firstDayOfWeek(locale: string): number {
  try {
    const loc = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const day = (loc.getWeekInfo?.() ?? loc.weekInfo)?.firstDay;
    return day && day >= 1 && day <= 7 ? day : 1;
  } catch {
    return 1;
  }
}
