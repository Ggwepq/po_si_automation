export default function Icon({name, size = 20, ...props}) {
  const paths = {
    upload: <><path d="M12 16V4m-4 4 4-4 4 4"/><path d="M4 15v5h16v-5"/></>,
    file: <><path d="M14 3H6v18h12V7z"/><path d="M14 3v5h4M9 12h6m-6 4h6"/></>,
    arrow: <path d="M4 12h16m-5-5 5 5-5 5"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    download: <><path d="M12 3v13m-4-4 4 4 4-4M4 17v4h16v-4"/></>,
    chevron: <path d="m8 5 7 7-7 7"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
