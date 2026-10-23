"use client";
import { useState } from "react";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [error, setError] = useState("");
  const [captchaCode] = useState(Math.floor(1000 + Math.random() * 9000).toString());

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.endsWith("@rvce.edu.in")) {
      setError("Only @rvce.edu.in emails are allowed.");
      return;
    }
    
    if (captchaAnswer !== captchaCode) {
      setError("Incorrect CAPTCHA code.");
      return;
    }

    if (password.length < 6) {
      setError("Invalid password.");
      return;
    }

    // Simulate successful login, set cookie and redirect
    let role = "student";
    let redirectUrl = "/";
    
    if (email.startsWith("admin")) {
      role = "admin";
      redirectUrl = "/admin";
    } else if (email.startsWith("hod")) {
      role = "hod";
      redirectUrl = "/hod";
    }
    
    document.cookie = `auth-session=${role}; path=/`;
    window.location.href = redirectUrl;
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Image 
          alt="RVCE Institutional AI" 
          width={120} 
          height={32} 
          className="mx-auto h-12 w-auto object-contain" 
          src="https://lh3.googleusercontent.com/aida/AEtjO1X-f3Zd5H_jVeXeJo6-I4AbVYq1lETC2J6AYeV6jO9duYsSwdXSsqv5_HM73dYt4q8e5kdPjAZmPTaBWoPRF14i0sgf0kvP7sCVPHKcFd0of9deqVS9QZHGzw95ed_Js9Ol0jx2fRZhmJwuN67Uw8szoMAd8C5Jfw7HtIeSL1v4w8kEBA0V1sPpOss6ayHy8wwqTDJna4o1dJTyKQ7_maPGxvAlQS6mnQ-QCTMURe-4m5mX_JH1zA0rrQo"
        />
        <h2 className="mt-6 text-center font-headline-md text-headline-md text-on-surface">
          Institutional Access
        </h2>
        <p className="mt-2 text-center font-body-sm text-body-sm text-on-surface-variant">
          Sign in with your @rvce.edu.in account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface-container-lowest py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-surface-variant">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="p-3 bg-error-container text-on-error-container text-label-sm font-label-sm rounded-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {error}
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block font-label-sm text-label-sm text-on-surface font-medium">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-variant rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
                  placeholder="student@rvce.edu.in"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block font-label-sm text-label-sm text-on-surface font-medium">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-variant rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
              </div>
            </div>

            <div>
              <label htmlFor="captcha" className="block font-label-sm text-label-sm text-on-surface font-medium mb-1">
                Security Verification
              </label>
              <div className="flex gap-4">
                <div className="bg-surface-container-high rounded-lg px-4 flex items-center justify-center border border-surface-variant">
                  <span className="font-code-sm text-code-sm text-on-surface tracking-widest font-bold text-lg select-none">
                    {captchaCode}
                  </span>
                </div>
                <input
                  id="captcha"
                  name="captcha"
                  type="text"
                  required
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  className="flex-1 px-3 py-2 border border-surface-variant rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
                  placeholder="Enter code"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm font-label-md text-label-md font-medium text-on-primary bg-primary-container hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-container transition-all active:scale-[0.99]"
              >
                Sign in
              </button>
            </div>
          </form>
          
          <div className="mt-6 text-center">
            <div className="flex items-center justify-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">lock</span>
              <span className="font-label-sm text-label-sm">Secured via Campus IAM</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
