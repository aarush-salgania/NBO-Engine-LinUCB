// Final dashboard shell. useSimulation() is called once here and its state is
// threaded down as props; CustomerInspector owns its own fetch. Accent (blue) is
// reserved for LinUCB elements and the Run button only.
import { useSimulation } from './hooks/useSimulation'
import StatCards from './components/StatCards'
import RewardChart from './components/RewardChart'
import SegmentDistribution from './components/SegmentDistribution'
import CustomerInspector from './components/CustomerInspector'

function App() {
  const { running, setRunning, reset, metrics, segments } = useSimulation()
  const t = metrics?.summary?.t

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">
              NBO Personalization Engine
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Contextual bandits vs. baselines on 5,000 synthetic cardmembers
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Step</div>
              <div className="text-lg font-semibold tabular-nums text-slate-100">
                {t == null ? '—' : t.toLocaleString()}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRunning(!running)}
              className={
                'rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ' +
                (running ? 'bg-slate-700 hover:bg-slate-600' : 'bg-blue-500 hover:bg-blue-400')
              }
            >
              {running ? 'Pause' : 'Run'}
            </button>
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
            >
              Reset
            </button>
          </div>
        </header>

        <StatCards summary={metrics?.summary} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <RewardChart series={metrics?.history?.series} />
          </div>
          <div className="lg:col-span-2">
            <SegmentDistribution segments={segments} />
          </div>
        </div>

        <CustomerInspector />
      </div>
    </div>
  )
}

export default App
