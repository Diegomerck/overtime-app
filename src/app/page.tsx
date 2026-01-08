"use client";

import { useState } from "react";

type Entry = {
  date: string; // stored as ISO yyyy-mm-dd
  clockIn: string;
  clockOut: string;
  workedHours: number;
  overtimeHours: number;
};

const DAILY_BASE_HOURS = 9.5;
const WEEKLY_DOUBLE_LIMIT = 9;

function getWeekStart(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sun
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  return new Date(date.setDate(diff));
}

export default function Home() {
  const [date, setDate] = useState(""); // yyyy-mm-dd from <input type=date>
  const [clockIn, setClockIn] = useState(""); 
  const [clockOut, setClockOut] = useState(""); 
  const [entries, setEntries] = useState<Entry[]>([]);

  function calculateAndSave() {
    if (!date || !clockIn || !clockOut) {
      alert("Please fill date, clock in and clock out");
      return;
    }

    const [inH, inM] = clockIn.split(":").map(Number);
    const [outH, outM] = clockOut.split(":").map(Number);

    const start = inH * 60 + inM;
    const end = outH * 60 + outM;

    let diffMinutes = end - start;
    if (diffMinutes < 0) diffMinutes += 24 * 60;

    const totalHours = diffMinutes / 60;
    const ot = Math.max(0, totalHours - DAILY_BASE_HOURS);

    const newEntry: Entry = {
      date, // keep ISO format
      clockIn,
      clockOut,
      workedHours: Number(totalHours.toFixed(2)),
      overtimeHours: Number(ot.toFixed(2)),
    };

    setEntries((prev) => [...prev, newEntry]);

    // reset fields
    setClockIn(""); 
    setClockOut(""); 
  }

  // ----- WEEK FILTER -----
  const today = new Date();
  const weekStart = getWeekStart(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weekEntries = entries.filter((e) => {
    const d = new Date(e.date + "T00:00:00"); // force local midnight
    return d >= weekStart && d <= weekEnd;
  });

  const dayMap: Record<string, { hours: number; ot: number }> = {
    Mon: { hours: 0, ot: 0 },
    Tue: { hours: 0, ot: 0 },
    Wed: { hours: 0, ot: 0 },
    Thu: { hours: 0, ot: 0 },
    Fri: { hours: 0, ot: 0 },
    Sat: { hours: 0, ot: 0 },
    Sun: { hours: 0, ot: 0 },
  };

  weekEntries.forEach((e) => {
    const d = new Date(e.date + "T00:00:00");
    const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
    if (dayMap[dayName]) {
      dayMap[dayName].hours += e.workedHours;
      dayMap[dayName].ot += e.overtimeHours;
    }
  });

  const totalWeeklyOT = weekEntries.reduce((sum, e) => sum + e.overtimeHours, 0);
  const doubleOT = Math.min(totalWeeklyOT, WEEKLY_DOUBLE_LIMIT);
  const tripleOT = Math.max(0, totalWeeklyOT - WEEKLY_DOUBLE_LIMIT);

  return (
    <main className="min-h-screen bg-slate-900 p-6 text-slate-100">

      {/* This Week */}
      <section className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 p-6 mb-6">
        <h2 className="text-2xl font-bold text-white mb-4">This Week</h2>

        <div className="grid grid-cols-7 gap-3 text-center mb-6">
          {Object.entries(dayMap).map(([day, data]) => (
            <div key={day} className="border border-slate-600 rounded-lg p-3 bg-slate-700">
              <div className="font-semibold text-white">{day}</div>
              <div className="text-sm text-slate-200 mt-1">
                {data.hours ? data.hours.toFixed(2) : "--"} h
              </div>
              <div className="text-xs text-orange-300 mt-1">
                OT: {data.ot ? data.ot.toFixed(2) : "--"}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 text-slate-200">
          <div>Total OT this week: <strong className="text-white">{totalWeeklyOT.toFixed(2)} h</strong></div>
          <div>Double OT (×2): <strong className="text-green-400">{doubleOT.toFixed(2)} h</strong></div>
          <div>Triple OT (×3): <strong className="text-red-400">{tripleOT.toFixed(2)} h</strong></div>
        </div>
      </section>

      {/* Add Today's Hours */}
      <section className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 p-6 mb-6">
        <h2 className="text-2xl font-bold text-white mb-4">Add Today’s Hours</h2>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-medium text-slate-200 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-slate-900 text-white border border-slate-600 rounded-lg p-2"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col flex-1">
              <label className="text-sm font-medium text-slate-200 mb-1">Clock In</label>
              <input
                type="time"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                className="bg-slate-900 text-white border border-slate-600 rounded-lg p-2"
              />
            </div>

            <div className="flex flex-col flex-1">
              <label className="text-sm font-medium text-slate-200 mb-1">Clock Out</label>
              <input
                type="time"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
                className="bg-slate-900 text-white border border-slate-600 rounded-lg p-2"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={calculateAndSave}
            className="bg-blue-600 text-white rounded-lg p-3 font-semibold hover:bg-blue-700 transition-colors"
          >
            Save
          </button>
        </div>
      </section>

      {/* Entries */}
      <section className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white mb-4">This Week’s Entries</h2>

        {weekEntries.length === 0 ? (
          <div className="text-slate-400">No entries yet.</div>
        ) : (
          <div className="space-y-3">
            {weekEntries.map((e, idx) => (
              <div key={idx} className="flex justify-between items-center bg-slate-700 rounded-lg p-3 text-slate-200">
                <div>
                  <div className="text-white font-semibold">{e.date}</div>
                  <div className="text-sm">{e.clockIn} – {e.clockOut}</div>
                </div>
                <div className="text-right">
                  <div>{e.workedHours} h</div>
                  <div className="text-sm text-orange-300">OT: {e.overtimeHours} h</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </main>
  );
}
