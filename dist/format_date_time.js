import memoizeOne from"memoize-one";import{useAmPm}from"./use_am_pm";let formatDateTime=(e,m)=>formatDateTimeMem(m).format(e),formatDateTimeMem=memoizeOne(e=>new Intl.DateTimeFormat("en"!==e.language||useAmPm(e)?e.language:"en-u-hc-h23",{year:"numeric",month:"long",day:"numeric",hour:useAmPm(e)?"numeric":"2-digit",minute:"2-digit",hour12:useAmPm(e)})),formatShortDateTimeWithYear=(e,m)=>formatShortDateTimeWithYearMem(m).format(e),formatShortDateTimeWithYearMem=memoizeOne(e=>new Intl.DateTimeFormat("en"!==e.language||useAmPm(e)?e.language:"en-u-hc-h23",{year:"numeric",month:"short",day:"numeric",hour:useAmPm(e)?"numeric":"2-digit",minute:"2-digit",hour12:useAmPm(e)})),formatShortDateTime=(e,m)=>formatShortDateTimeMem(m).format(e),formatShortDateTimeMem=memoizeOne(e=>new Intl.DateTimeFormat("en"!==e.language||useAmPm(e)?e.language:"en-u-hc-h23",{month:"short",day:"numeric",hour:useAmPm(e)?"numeric":"2-digit",minute:"2-digit",hour12:useAmPm(e)})),formatDateTimeWithSeconds=(e,m)=>formatDateTimeWithSecondsMem(m).format(e),formatDateTimeWithSecondsMem=memoizeOne(e=>new Intl.DateTimeFormat("en"!==e.language||useAmPm(e)?e.language:"en-u-hc-h23",{year:"numeric",month:"long",day:"numeric",hour:useAmPm(e)?"numeric":"2-digit",minute:"2-digit",second:"2-digit",hour12:useAmPm(e)})),formatDateTimeNumeric=(e,m)=>formatDateTimeNumericMem(m).format(e),formatDateTimeNumericMem=memoizeOne(e=>new Intl.DateTimeFormat("en"!==e.language||useAmPm(e)?e.language:"en-u-hc-h23",{year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"2-digit",hour12:useAmPm(e)}));export{formatDateTime,formatShortDateTimeWithYear,formatShortDateTime,formatDateTimeWithSeconds,formatDateTimeNumeric};