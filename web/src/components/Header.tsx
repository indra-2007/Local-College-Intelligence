import Image from "next/image";

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-surface/85 backdrop-blur-xl border-b border-surface-variant z-50">
      <div className="w-full h-full px-space-lg flex items-center justify-between">
        <div className="flex items-center gap-space-md">
          <Image
            alt="Brand logo."
            width={120}
            height={32}
            className="h-8 w-auto object-contain"
            src="https://lh3.googleusercontent.com/aida/AEtjO1X-f3Zd5H_jVeXeJo6-I4AbVYq1lETC2J6AYeV6jO9duYsSwdXSsqv5_HM73dYt4q8e5kdPjAZmPTaBWoPRF14i0sgf0kvP7sCVPHKcFd0of9deqVS9QZHGzw95ed_Js9Ol0jx2fRZhmJwuN67Uw8szoMAd8C5Jfw7HtIeSL1v4w8kEBA0V1sPpOss6ayHy8wwqTDJna4o1dJTyKQ7_maPGxvAlQS6mnQ-QCTMURe-4m5mX_JH1zA0rrQo"
          />
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm text-on-surface leading-none">
              RVCE Institutional AI
            </span>
            <span className="font-code-sm text-code-sm text-on-surface-variant mt-space-2xs">
              Campus Intelligence
            </span>
          </div>
        </div>
        <div className="flex items-center gap-space-lg">
          <div className="hidden sm:flex items-center gap-space-xs px-space-md py-space-2xs rounded-full bg-secondary-container/40 border border-secondary">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span className="font-label-sm text-label-sm text-on-secondary-container font-medium">
              Local AI Online
            </span>
          </div>
          <div className="flex items-center gap-space-md pl-space-md border-l border-surface-variant">
            <div className="text-right hidden md:block">
              <div className="font-label-md text-label-md text-on-surface font-medium leading-tight">
                Rohan K.
              </div>
              <div className="font-label-sm text-label-sm text-on-surface-variant">
                Student • CSE Dept
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-[18px]">
                person
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
