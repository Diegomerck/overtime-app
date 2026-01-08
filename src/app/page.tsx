"use client";

import { useEffect, useState } from "react";

type Entry = {
  date: string;
  clockIn: string;
  clockOut: string;
};

const DAILY_THRESHOLD = 9.5;
const MAX_DOUBLE_OT = 9;

// Always get Monday of current week
const getMonday = () => {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getWeekDates = () => {
  const monday = getMonday();
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
};

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const calcHours = (start: string, end: string) => {
  if (!start || !end) return 0;

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  const diff = endMin - startMin;
  if (diff <= 0) return 0;

  return diff / 60;
};

const isWeekend = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
};

export default function Home() {
  const [mounted, setMounted] = useState(false);

  const [salaryDailyInput, setSalaryDailyInput] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);

  const [selectedDate, setSelectedDate] = useState("");
  const [editDate, setEditDate] = useState(false);

  const [manualIn, setManualIn] = useState("");
  const [manualOut, setManualOut] = useState("");

  // ----------------- MOUNT -----------------
  useEffect(() => {
    setMounted(true);
    const today = new Date().toISOString().split("T")[0];
    setSelectedDate(today);
  }, []);

  // ----------------- LOAD -----------------
  useEffect(() => {
    if (!mounted) return;

    const savedSalary = localStorage.getItem("salaryDaily");
    const savedEntries = localStorage.getItem("entries");

    if (savedSalary) setSalaryDailyInput(savedSalary);
    if (savedEntries) setEntries(JSON.parse(savedEntries));
  }, [mounted]);

  // ----------------- SAVE -----------------
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("salaryDaily", salaryDailyInput);
  }, [salaryDailyInput, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("entries", JSON.stringify(entries));
  }, [entries, mounted]);

  if (!mounted) return null;

  // ----------------- PARSE SALARY -----------------
  const salaryDaily = parseFloat(salaryDailyInput.replace(",", "."));
  const validSalary = !isNaN(salaryDaily) && salaryDaily > 0;
  const hourlyRate = validSalary ? salaryDaily / 8 : 0;

  // ----------------- WEEK BUILD -----------------
  const weekDates = getWeekDates();

  const weekRaw = weekDates.map((date) => {
    const found = entries.find((e) => e.date === date);
    const clockIn = found?.clockIn || "";
    const clockOut = found?.clockOut || "";
    const hours = calcHours(clockIn, clockOut);
    const weekend = isWeekend(date);
    const worked = hours > 0;

    return { date, clockIn, clockOut, hours, weekend, worked };
  });

  // ----------------- TIEMPO EXTRA DISTRIBUTION -----------------
  let remainingDouble = MAX_DOUBLE_OT;

  const weekFinal = weekRaw.map((day) => {
    const overtime = Math.max(0, day.hours - DAILY_THRESHOLD);

    let double = 0;
    let triple = 0;

    if (remainingDouble > 0) {
      double = Math.min(overtime, remainingDouble);
      remainingDouble -= double;
    }

    const leftover = overtime - double;
    if (leftover > 0) triple = leftover;

    const tiempoExtraPay = validSalary
      ? double * hourlyRate * 2 + triple * hourlyRate * 3
      : 0;

    // ----------------- BASE PAY LOGIC (FINAL & CORRECT) -----------------
    let basePay = 0;

    if (validSalary && day.worked) {
      if (day.weekend) {
        basePay = salaryDaily * 2; // Saturday/Sunday worked
      } else {
        basePay = salaryDaily; // Monday–Friday worked
      }
    }

    return {
      ...day,
      overtime,
      double,
      triple,
      tiempoExtraPay,
      basePay
    };
  });

  const totalWeekHours = weekFinal.reduce((s, d) => s + d.hours, 0);
  const totalTiempoExtra = weekFinal.reduce((s, d) => s + d.overtime, 0);
  const totalDouble = weekFinal.reduce((s, d) => s + d.double, 0);
  const totalTriple = weekFinal.reduce((s, d) => s + d.triple, 0);
  const totalTiempoExtraPay = weekFinal.reduce((s, d) => s + d.tiempoExtraPay, 0);
  const totalBasePay = weekFinal.reduce((s, d) => s + d.basePay, 0);
  const grandTotalPay = totalBasePay + totalTiempoExtraPay;

  const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

  const nowTime = () => new Date().toTimeString().slice(0, 5);

  // ----------------- ACTIONS -----------------
  const clockInNow = () => {
    setEntries((prev) => {
      const filtered = prev.filter((e) => e.date !== selectedDate);
      return [...filtered, { date: selectedDate, clockIn: nowTime(), clockOut: "" }];
    });
  };

  const clockOutNow = () => {
    setEntries((prev) => {
      const existing = prev.find((e) => e.date === selectedDate);
      const filtered = prev.filter((e) => e.date !== selectedDate);

      return [
        ...filtered,
        {
          date: selectedDate,
          clockIn: existing?.clockIn || "",
          clockOut: nowTime()
        }
      ];
    });
  };

  const saveManual = () => {
    setEntries((prev) => {
      const existing = prev.find((e) => e.date === selectedDate);
      const filtered = prev.filter((e) => e.date !== selectedDate);

      return [
        ...filtered,
        {
          date: selectedDate,
          clockIn: manualIn || existing?.clockIn || "",
          clockOut: manualOut || existing?.clockOut || ""
        }
      ];
    });

    setManualIn("");
    setManualOut("");
  };

  const resetAll = () => {
    if (!confirm("¿Seguro que quieres borrar todos los datos?")) return;
    localStorage.clear();
    setEntries([]);
    setSalaryDailyInput("");
  };

  // ----------------- UI -----------------
  return (
    <main className="min-h-screen bg-zinc-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">Control de Tiempo Extra</h1>

      {/* SALARY */}
      <section className="bg-zinc-800 p-4 rounded-xl mb-6">
        <h2 className="text-xl font-semibold mb-2">Salario diario</h2>
        <input
          type="text"
          value={salaryDailyInput}
          onChange={(e) => setSalaryDailyInput(e.target.value)}
          className="w-full p-2 rounded bg-zinc-700"
          placeholder="Ej: 876.47"
        />
        <p className="text-sm text-zinc-400 mt-2">
          Tarifa por hora: ${hourlyRate.toFixed(2)}
        </p>
      </section>

      {/* SUMMARY */}
      <section className="bg-zinc-800 p-4 rounded-xl mb-6">
        <h2 className="text-xl font-semibold mb-4">Resumen semanal</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
          <div className="bg-zinc-700 p-3 rounded">
            <div className="text-sm text-zinc-300">Horas totales</div>
            <div className="text-2xl font-bold">{totalWeekHours.toFixed(2)}</div>
          </div>
          <div className="bg-zinc-700 p-3 rounded">
            <div className="text-sm text-zinc-300">Tiempo Extra</div>
            <div className="text-2xl font-bold">{totalTiempoExtra.toFixed(2)}</div>
          </div>
          <div className="bg-zinc-700 p-3 rounded">
            <div className="text-sm text-zinc-300">2x</div>
            <div className="text-2xl font-bold text-yellow-400">{totalDouble.toFixed(2)}</div>
          </div>
          <div className="bg-zinc-700 p-3 rounded">
            <div className="text-sm text-zinc-300">3x</div>
            <div className="text-2xl font-bold text-red-400">{totalTriple.toFixed(2)}</div>
          </div>
          <div className="bg-zinc-700 p-3 rounded">
            <div className="text-sm text-zinc-300">Pago base</div>
            <div className="text-2xl font-bold">${totalBasePay.toFixed(2)}</div>
          </div>
          <div className="bg-zinc-700 p-3 rounded">
            <div className="text-sm text-zinc-300">Total semana</div>
            <div className="text-2xl font-bold text-green-400">${grandTotalPay.toFixed(2)}</div>
          </div>
        </div>
      </section>

      {/* WEEK TABLE */}
      <section className="bg-zinc-800 p-4 rounded-xl mb-6 overflow-x-auto">
        <h2 className="text-xl font-semibold mb-4">Semana actual</h2>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-600 text-zinc-300">
              <th className="p-2 text-left">Día</th>
              <th className="p-2">Fecha</th>
              <th className="p-2">Entrada</th>
              <th className="p-2">Salida</th>
              <th className="p-2">Horas</th>
              <th className="p-2">Base</th>
              <th className="p-2">Tiempo Extra</th>
              <th className="p-2">Pago Extra</th>
            </tr>
          </thead>
          <tbody>
            {weekFinal.map((d, i) => (
              <tr key={d.date} className="border-b border-zinc-700 text-center">
                <td className="p-2 text-left">
                  {dayNames[i]} {d.weekend && d.worked && <span className="text-blue-400">(2x)</span>}
                </td>
                <td className="p-2">{formatDate(d.date)}</td>
                <td className="p-2">{d.clockIn || "-"}</td>
                <td className="p-2">{d.clockOut || "-"}</td>
                <td className="p-2">{d.hours.toFixed(2)}</td>
                <td className="p-2">${d.basePay.toFixed(2)}</td>
                <td className="p-2">
                  {d.double > 0 && <span className="text-yellow-400">{d.double.toFixed(2)}h 2x </span>}
                  {d.triple > 0 && <span className="text-red-400">{d.triple.toFixed(2)}h 3x</span>}
                </td>
                <td className="p-2 text-green-400">${d.tiempoExtraPay.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* INPUT */}
      <section className="bg-zinc-800 p-4 rounded-xl">
        <h2 className="text-xl font-semibold mb-4">Registrar jornada</h2>

        <div className="flex items-center gap-2 mb-4">
          <input type="checkbox" checked={editDate} onChange={() => setEditDate(!editDate)} />
          <span className="text-sm">Editar fecha</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            disabled={!editDate}
            className="p-2 rounded bg-zinc-700 disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <button onClick={clockInNow} className="bg-green-600 hover:bg-green-700 p-2 rounded font-semibold">
            Registrar Entrada (Ahora)
          </button>
          <button onClick={clockOutNow} className="bg-red-600 hover:bg-red-700 p-2 rounded font-semibold">
            Registrar Salida (Ahora)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <input
            type="time"
            value={manualIn}
            onChange={(e) => setManualIn(e.target.value)}
            className="p-2 rounded bg-zinc-700"
          />
          <input
            type="time"
            value={manualOut}
            onChange={(e) => setManualOut(e.target.value)}
            className="p-2 rounded bg-zinc-700"
          />
          <button onClick={saveManual} className="bg-blue-600 hover:bg-blue-700 p-2 rounded font-semibold">
            Guardar manual
          </button>
        </div>

        <button onClick={resetAll} className="bg-zinc-700 hover:bg-zinc-600 p-2 rounded text-sm">
          Borrar todos los datos
        </button>
      </section>
    </main>
  );
}
