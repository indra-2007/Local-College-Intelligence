"use client";
import Link from "next/link";
import { useState } from "react";


export default function Dashboard() {
const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [placeholder, setPlaceholder] = useState("Ask anything about your syllabus, attendance, regulations, or exams...");

  const handleQuery = () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setQuery("");
      setPlaceholder("Query received. Switching to AI Assistant view...");
      setTimeout(() => {
        setPlaceholder("Ask anything about your syllabus, attendance, regulations, or exams...");
      }, 2500);
    }, 600);
  };

  const handleSuggestionClick = (text: string) => {
    setQuery(text);
  };


  return (
    <>
      <div className="max-w-7xl mx-auto w-full px-space-base md:px-space-xl py-space-xl space-y-space-xl">
{/*  Top Greeting & Context Bar  */}
<div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
<div className="space-y-space-2xs">
<div className="inline-flex items-center gap-space-xs px-space-sm py-space-2xs rounded-full bg-surface-container text-on-surface-variant">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
<span className="font-code-sm text-code-sm font-medium tracking-tight">SEM VI • COMPUTER SCIENCE &amp; ENGINEERING</span>
</div>
<h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Good morning, Rohan</h1>
<p className="font-body-md text-body-md text-on-surface-variant">Here is your campus academic summary and offline institutional intelligence.</p>
</div>
<div className="flex items-center gap-space-sm">
<div className="flex items-center gap-space-xs px-space-md py-space-sm rounded-xl bg-surface-container-lowest shadow-sm text-on-surface">
<span className="material-symbols-outlined text-[18px] text-secondary">verified</span>
<span className="font-label-sm text-label-sm font-medium">Regulation R-22 Autonomous</span>
</div>
</div>
</div>
{/*  Central ChatGPT / Notion Style Search & Query Hub  */}
<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm space-y-space-md">
<div className="relative flex items-center">
<span className="material-symbols-outlined absolute left-space-md text-[22px] text-on-surface-variant">search</span>
<input id="academicQueryInput" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleQuery()} disabled={isLoading} placeholder={placeholder} type="text" className="w-full pl-12 pr-28 py-3.5 bg-surface-container-low focus:bg-surface-container-lowest text-on-surface rounded-xl font-body-md text-body-md placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary-container transition-all" />
<div className="absolute right-space-sm flex items-center gap-space-xs">
<kbd className="hidden sm:inline-block px-space-xs py-space-2xs font-code-sm text-code-sm bg-surface-container text-on-surface-variant rounded">⌘K</kbd>
<button className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-container text-on-primary hover:opacity-90 active:scale-95 transition-all" onClick={handleQuery} disabled={isLoading}>
{isLoading ? <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span> : <span className="material-symbols-outlined text-[18px]">arrow_upward</span>}
</button>
</div>
</div>
{/*  Quick Suggested Prompt Chips  */}
<div className="flex flex-wrap items-center gap-space-xs pt-space-2xs">
<span className="font-label-sm text-label-sm text-on-surface-variant mr-space-2xs">Suggested:</span>
<button className="px-space-sm py-1.5 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-body-sm text-body-sm text-left" onClick={(e) => handleSuggestionClick(e.currentTarget.innerText)}>
          What is the attendance criteria for condonation?
        </button>
<button className="px-space-sm py-1.5 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-body-sm text-body-sm text-left" onClick={(e) => handleSuggestionClick(e.currentTarget.innerText)}>
          Fast-track exam dates 2025
        </button>
<button className="px-space-sm py-1.5 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-body-sm text-body-sm text-left" onClick={(e) => handleSuggestionClick(e.currentTarget.innerText)}>
          How to calculate CGPA with new credits?
        </button>
</div>
</div>
{/*  4 Clean Academic Metric Cards  */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
{/*  Metric 1: Attendance  */}
<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm space-y-space-md flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Overall Attendance</span>
<span className="material-symbols-outlined text-[20px] text-secondary">check_circle</span>
</div>
<div className="space-y-space-xs">
<div className="flex items-baseline gap-space-xs">
<span className="font-headline-xl text-headline-xl text-on-surface">86.4</span>
<span className="font-headline-sm text-headline-sm text-on-surface-variant">%</span>
</div>
{/*  Clean Bar Indicator  */}
<div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full" style={{ width: '86.4%' }}></div>
</div>
</div>
<div className="flex items-center gap-space-2xs text-on-secondary-container">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
<span className="font-code-sm text-code-sm font-medium">Safe • Above 75% threshold</span>
</div>
</div>
{/*  Metric 2: CGPA  */}
<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm space-y-space-md flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Current CGPA</span>
<span className="material-symbols-outlined text-[20px] text-on-surface-variant">school</span>
</div>
<div className="space-y-space-xs">
<div className="flex items-baseline gap-space-xs">
<span className="font-headline-xl text-headline-xl text-on-surface">8.92</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">/ 10.0</span>
</div>
<p className="font-code-sm text-code-sm text-on-surface-variant">Top 8% in CSE cohort</p>
</div>
<div className="text-on-surface-variant font-label-sm text-label-sm">
          6th Semester • No active backlogs
        </div>
</div>
{/*  Metric 3: Enrolled Courses  */}
<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm space-y-space-md flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Enrolled Courses</span>
<span className="material-symbols-outlined text-[20px] text-on-surface-variant">book</span>
</div>
<div className="space-y-space-xs">
<div className="flex items-baseline gap-space-xs">
<span className="font-headline-xl text-headline-xl text-on-surface">6</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Subjects</span>
</div>
<p className="font-code-sm text-code-sm text-on-surface-variant truncate">CS601, CS602, CS603, CS604</p>
</div>
<div className="text-on-surface-variant font-label-sm text-label-sm">
          Elective I + Advanced ML Lab
        </div>
</div>
{/*  Metric 4: Offline Documents  */}
<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm space-y-space-md flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Offline Documents</span>
<span className="material-symbols-outlined text-[20px] text-primary-container">file_download_done</span>
</div>
<div className="space-y-space-xs">
<div className="flex items-baseline gap-space-xs">
<span className="font-headline-xl text-headline-xl text-on-surface">4</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Ready</span>
</div>
<p className="font-code-sm text-code-sm text-on-surface-variant">Indexed on campus node</p>
</div>
<div className="text-on-surface-variant font-label-sm text-label-sm truncate">
          Syllabus, Regulations, Timetable
        </div>
</div>
</div>
{/*  Two-Column Main Workspace  */}
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
{/*  Left Column: Course Attendance Breakdown (7 Cols)  */}
<div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm space-y-space-lg">
<div className="flex items-center justify-between">
<div>
<h2 className="font-headline-sm text-headline-sm text-on-surface">Course Attendance Breakdown</h2>
<p className="font-body-sm text-body-sm text-on-surface-variant">Calculated per lecture credit hour as of current cycle.</p>
</div>
<span className="font-code-sm text-code-sm px-space-sm py-1 rounded bg-surface-container text-on-surface-variant">Min. 75% required</span>
</div>
<div className="space-y-space-md">
{/*  Course 1  */}
<div className="p-space-md rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors space-y-space-xs">
<div className="flex items-center justify-between">
<div className="space-y- space-2xs">
<div className="flex items-center gap-space-xs">
<span className="font-code-sm text-code-sm px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">CS601</span>
<span className="font-label-md text-label-md text-on-surface font-semibold">Operating Systems</span>
</div>
<div className="font-code-sm text-code-sm text-on-surface-variant">Prof. M. S. Sundar • 44 of 50 classes attended</div>
</div>
<div className="text-right">
<span className="font-headline-sm text-headline-sm text-on-surface font-semibold">88%</span>
<span className="block font-label-sm text-label-sm text-secondary font-medium">Good standing</span>
</div>
</div>
<div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden mt-space-xs">
<div className="bg-secondary h-full rounded-full" style={{ width: '88%' }}></div>
</div>
</div>
{/*  Course 2 (Warning state)  */}
<div className="p-space-md rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors space-y-space-xs">
<div className="flex items-center justify-between">
<div className="space-y-space-2xs">
<div className="flex items-center gap-space-xs">
<span className="font-code-sm text-code-sm px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">CS602</span>
<span className="font-label-md text-label-md text-on-surface font-semibold">Compiler Design</span>
</div>
<div className="font-code-sm text-code-sm text-on-surface-variant">Dr. Aruna Rao • 29 of 39 classes attended</div>
</div>
<div className="text-right">
<span className="font-headline-sm text-headline-sm text-error font-semibold">74%</span>
<span className="block font-label-sm text-label-sm text-error font-medium">Needs 2 classes</span>
</div>
</div>
<div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden mt-space-xs">
<div className="bg-error h-full rounded-full" style={{ width: '74%' }}></div>
</div>
</div>
{/*  Course 3  */}
<div className="p-space-md rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors space-y-space-xs">
<div className="flex items-center justify-between">
<div className="space-y-space-2xs">
<div className="flex items-center gap-space-xs">
<span className="font-code-sm text-code-sm px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">CS603</span>
<span className="font-label-md text-label-md text-on-surface font-semibold">Computer Networks</span>
</div>
<div className="font-code-sm text-code-sm text-on-surface-variant">Prof. Vikram Patil • 46 of 50 classes attended</div>
</div>
<div className="text-right">
<span className="font-headline-sm text-headline-sm text-on-surface font-semibold">92%</span>
<span className="block font-label-sm text-label-sm text-secondary font-medium">Excellent</span>
</div>
</div>
<div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden mt-space-xs">
<div className="bg-secondary h-full rounded-full" style={{ width: '92%' }}></div>
</div>
</div>
{/*  Course 4  */}
<div className="p-space-md rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors space-y-space-xs">
<div className="flex items-center justify-between">
<div className="space-y-space-2xs">
<div className="flex items-center gap-space-xs">
<span className="font-code-sm text-code-sm px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">CS604</span>
<span className="font-label-md text-label-md text-on-surface font-semibold">Machine Learning Lab</span>
</div>
<div className="font-code-sm text-code-sm text-on-surface-variant">Dr. Preeti H. • 19 of 20 lab sessions completed</div>
</div>
<div className="text-right">
<span className="font-headline-sm text-headline-sm text-on-surface font-semibold">95%</span>
<span className="block font-label-sm text-label-sm text-secondary font-medium">Safe</span>
</div>
</div>
<div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden mt-space-xs">
<div className="bg-secondary h-full rounded-full" style={{ width: '95%' }}></div>
</div>
</div>
</div>
</div>
{/*  Right Column: Recent Verified Institutional Answers & Quick Tools (5 Cols)  */}
<div className="lg:col-span-5 space-y-space-lg">
{/*  Verified Answer Card  */}
<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm space-y-space-md">
<div className="flex items-center justify-between">
<div className="flex items-center gap-space-xs">
<span className="material-symbols-outlined text-[18px] text-primary-container">auto_awesome</span>
<span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-primary-container">Verified Campus Answer</span>
</div>
<span className="font-code-sm text-code-sm text-on-surface-variant">Today, 09:14 AM</span>
</div>
<div className="space-y-space-xs">
<h3 className="font-headline-sm text-headline-sm text-on-surface">Autonomous Attendance Regulations (Sec 4.2)</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">Query: <em>&quot;What happens if my attendance drops between 65% and 75%?&quot;</em></p>
</div>
<div className="p-space-md rounded-xl bg-surface-container-low text-on-surface space-y-space-xs font-body-sm text-body-sm">
<div className="flex items-start gap-space-xs">
<span className="material-symbols-outlined text-[16px] text-secondary mt-0.5">check</span>
<span><strong>Condonation eligibility:</strong> Minimum 65% required under approved medical or collegiate extracurricular quota.</span>
</div>
<div className="flex items-start gap-space-xs">
<span className="material-symbols-outlined text-[16px] text-secondary mt-0.5">check</span>
<span><strong>Authority:</strong> Application must be endorsed by the Head of Department (HOD) and submitted to the Dean (Academic) 7 days before semester-end examinations.</span>
</div>
</div>
<div className="flex items-center justify-between pt-space-2xs">
<a className="inline-flex items-center gap-1 font-label-sm text-label-sm text-primary-container hover:underline font-medium" href="#">
<span>View verified document</span>
<span className="material-symbols-outlined text-[16px]">arrow_outward</span>
</a>
<span className="font-code-sm text-code-sm text-on-surface-variant">Cite: RVCE-AUT-2022.pdf#p34</span>
</div>
</div>
{/*  Quick Institutional Tools Card  */}
<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm space-y-space-md">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Quick Actions</span>
<span className="material-symbols-outlined text-[18px] text-on-surface-variant">bolt</span>
</div>
<div className="flex flex-col sm:flex-row gap-space-sm">
<Link href="/ai-assistant" className="flex-1 flex items-center justify-center gap-space-xs px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary hover:opacity-90 active:scale-[0.99] transition-all font-label-md text-label-md font-medium shadow-sm">
<span className="material-symbols-outlined text-[18px]">chat</span>
<span>Ask AI Assistant</span>
</Link>
<Link href="/upload" className="flex-1 flex items-center justify-center gap-space-xs px-space-md py-space-sm rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high active:scale-[0.99] transition-all font-label-md text-label-md font-medium">
<span className="material-symbols-outlined text-[18px]">upload_file</span>
<span>Upload Syllabus / Notes</span>
</Link>
</div>
</div>
</div>
</div>
</div>

    </>
  );
}
