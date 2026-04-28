import { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { 
  Calculator, 
  TrendingDown, 
  Zap, 
  CheckCircle,
  Lightbulb,
  ArrowRight,
  TrendingUp,
  Columns
} from 'lucide-react';
import {
  findSaddlePoint,
  findDominance,
  solve2x2Mixed,
  solveBrownRobinson
} from './math/gameTheory';
import type { Matrix } from './math/gameTheory';
import { generateGameTheoryReport } from './reportEngine';

// Регистрация ChartJS
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const INITIAL_MATRIX: Matrix = [
  [18, 26, 16],
  [24, 16, 22]
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "200px" },
  transition: { duration: 0.5 }
};

function App() {
  const [matrix, setMatrix] = useState<Matrix>(INITIAL_MATRIX);
  const chartRef = useRef<any>(null);

  const handleMatrixChange = (r: number, c: number, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      const newM = matrix.map((row, i) =>
        row.map((val, j) => (i === r && j === c ? num : val))
      );
      setMatrix(newM);
    }
  };

  const saddleResult = useMemo(() => findSaddlePoint(matrix), [matrix]);
  const domResult = useMemo(() => findDominance(matrix), [matrix]);
  const mixedResult = useMemo(() => solve2x2Mixed(domResult.reducedMatrix), [domResult.reducedMatrix]);
  const brResult = useMemo(() => solveBrownRobinson(matrix, 1000), [matrix]);
  
  const exactPrice = mixedResult ? mixedResult.v : parseFloat(brResult.vApprox.toFixed(2));

  const handleExportLP = () => {
    const report = {
      matrix: matrix,
      maximin: saddleResult.maximin,
      minimax: saddleResult.minimax,
      exactPrice: exactPrice,
      optimalStrategies: mixedResult ? {
        p: [mixedResult.p, 1 - mixedResult.p],
        q: [mixedResult.q, 1 - mixedResult.q]
      } : "Not available (requires advanced simplex solving)",
      brownRobinsonApproximation: brResult.vApprox
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lp_report.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = async () => {
    let chartBase64;
    if (chartRef.current) {
      chartBase64 = chartRef.current.toBase64Image();
    }
    
    await generateGameTheoryReport(
      matrix,
      saddleResult,
      domResult,
      mixedResult,
      brResult,
      exactPrice,
      chartBase64
    );
  };

  // Настройка графиков
  const chartData = useMemo(() => {
    const datasets: any[] = [];
    const colors = ['#0058bc', '#10b981', '#f59e0b', '#dc2626'];
    
    // Для матриц с 2 строками (Игрок А)
    if (matrix.length === 2) {
      matrix[0].forEach((_, colIdx) => {
        const y1 = matrix[1][colIdx]; // p=0 => A2
        const y2 = matrix[0][colIdx]; // p=1 => A1
        
        datasets.push({
          label: `Стратегия B${colIdx + 1}`,
          data: [{ x: 0, y: y1 }, { x: 1, y: y2 }],
          borderColor: colors[colIdx % colors.length],
          backgroundColor: colors[colIdx % colors.length],
          borderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 8,
          tension: 0
        });
      });
    }

    return { datasets };
  }, [matrix]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'linear' as const,
        position: 'bottom' as const,
        min: 0,
        max: 1,
        title: { display: true, text: 'Вероятность p (Выбор A1)', color: '#414755', font: { family: 'Inter', weight: 700 } },
        ticks: { color: '#717786', font: { family: 'Inter' } },
        grid: { color: '#e2e2e4' }
      },
      y: {
        title: { display: true, text: 'Ожидаемый выигрыш', color: '#414755', font: { family: 'Inter', weight: 700 } },
        ticks: { color: '#717786', font: { family: 'Inter' } },
        grid: { color: '#e2e2e4' }
      }
    },
    plugins: {
      legend: { labels: { color: '#1a1c1d', font: { family: 'Inter', size: 13, weight: 500 }, usePointStyle: true } },
    }
  };


  return (
    <div>
      {/* Навигация */}
      <header className="app-header-container">
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="label-md">Теория Игр и Исследование Операций</span>
            <h1 style={{ fontSize: '1.75rem', marginTop: '4px' }}>Solver Pro</h1>
          </div>
          <button className="btn btn-primary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Calculator size={18} />
            Новый Анализ
          </button>
        </div>
      </header>

      <main className="container">
        {/* Заголовок */}
        <div className="text-center" style={{ marginBottom: '100px', paddingTop: '40px' }}>
          <motion.span 
            className="label-md" 
            style={{ color: 'var(--tertiary)' }}
            {...fadeInUp}
          >
            Отчет об Анализе
          </motion.span>
          <motion.h2 
            style={{ fontSize: '4rem', letterSpacing: '-0.04em', margin: '16px 0' }}
            {...fadeInUp}
          >
            Смешанные Стратегии
          </motion.h2>
          <motion.p 
            style={{ fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto' }}
            {...fadeInUp}
          >
            Пошаговое решение матричной игры для Варианта 17: Распределение облачных ресурсов.
          </motion.p>
        </div>

        {/* Шаг 1: Ввод матрицы */}
        <motion.section {...fadeInUp} className="surface-card" style={{ marginBottom: '80px' }}>
          <div style={{ marginBottom: '40px' }}>
            <div className="label-md" style={{ marginBottom: '8px' }}>Шаг 1</div>
            <h3>Платежная Матрица A</h3>
            <p>Настройте коэффициенты полезности ресурсов платформы (Игрок А) в зависимости от профилей нагрузки (Игрок B).</p>
          </div>
          
          <div style={{ overflowX: 'auto', paddingBottom: '24px' }}>
            <table>
              <thead>
                <tr>
                  <th></th>
                  {matrix[0].map((_, j) => (
                    <th key={j}>Профиль B{j + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, i) => (
                  <tr key={i}>
                    <th style={{ textAlign: 'right', paddingRight: '32px', fontSize: '0.85rem' }}>Платформа A{i + 1}</th>
                    {row.map((val, j) => (
                      <td key={j}>
                        <div className="surface-card-inner" style={{ padding: '4px', minWidth: '120px' }}>
                          <input
                            type="number"
                            value={val}
                            onChange={(e) => handleMatrixChange(i, j, e.target.value)}
                            style={{ fontWeight: 800, fontSize: '1.75rem', color: 'var(--primary)', padding: '28px 16px', border: 'none' }}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div style={{ marginTop: '32px', display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={() => {
              setMatrix([...matrix, new Array(matrix[0].length).fill(0)]);
            }}>
              <TrendingUp size={18} />
              Добавить Стратегию A
            </button>
            <button className="btn btn-secondary" onClick={() => {
              setMatrix(matrix.map(r => [...r, 0]));
            }}>
              <Columns size={18} />
              Добавить Профиль B
            </button>
          </div>
        </motion.section>

        {/* Шаг 2: Седловая точка */}
        <motion.section {...fadeInUp} className="surface-card" style={{ marginBottom: '80px' }}>
          <div style={{ marginBottom: '40px' }}>
            <div className="label-md" style={{ marginBottom: '8px' }}>Шаг 2</div>
            <h3>Поиск Седловой Точки</h3>
            <p>Оцениваем наличие чистой стратегии через вычисление максимина и минимакса.</p>
          </div>
          
          <div className="grid grid-cols-2">
            <div className="surface-card-inner" style={{ padding: '32px' }}>
              <table>
                <thead>
                  <tr>
                    <th></th>
                    {matrix[0].map((_, j) => <th key={j}>B{j+1}</th>)}
                    <th className="highlight-warning">Min</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, i) => (
                    <tr key={i}>
                      <th style={{ fontSize: '0.75rem' }}>A{i + 1}</th>
                      {row.map((val, j) => (
                         <td key={j} style={{ fontWeight: 600 }}>{val}</td>
                      ))}
                      <td><div className="highlight-warning" style={{display:'inline-block', padding:'4px 12px', fontWeight: 'bold'}}>{saddleResult.rowMins[i]}</div></td>
                    </tr>
                  ))}
                  <tr>
                    <th className="highlight-success">Max</th>
                    {saddleResult.colMaxs.map((val, j) => (
                      <td key={j}><div className="highlight-success" style={{display:'inline-block', padding:'4px 12px', fontWeight: 'bold'}}>{val}</div></td>
                    ))}
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="info-block">
                <span className="label-md">Показатели</span>
                <p style={{ fontSize: '1.5rem', marginTop: '16px', fontWeight: 600 }}>
                  <span style={{ color: 'var(--outline)' }}>v̱ (максимин) = </span> 
                  <strong style={{ color: 'var(--warning)' }}>{saddleResult.maximin}</strong>
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                  <span style={{ color: 'var(--outline)' }}>v̄ (минимакс) = </span> 
                  <strong style={{ color: 'var(--success)' }}>{saddleResult.minimax}</strong>
                </p>
              </div>
              
              <div className="info-block">
                {saddleResult.hasSaddlePoint ? (
                   <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '16px', fontSize: '1.25rem', fontWeight: 700 }}>
                      <CheckCircle size={32} /> Найдена седловая точка: {saddleResult.maximin}
                   </div>
                ) : (
                   <div style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '16px', fontSize: '1.25rem', fontWeight: 700 }}>
                      <Lightbulb size={32} /> v̱ ≠ v̄. Решение в смешанных стратегиях.
                   </div>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Шаг 3: Доминирование */}
        <motion.section {...fadeInUp} className="surface-card" style={{ marginBottom: '80px' }}>
          <div style={{ marginBottom: '40px' }}>
            <div className="label-md" style={{ marginBottom: '8px' }}>Шаг 3</div>
            <h3>Редукция Матрицы</h3>
            <p>Исключение строго доминируемых стратегий для упрощения пространства решений.</p>
          </div>
          
          <div className="grid grid-cols-2">
            <div className="info-block">
              <span className="label-md">Лог анализа</span>
              {domResult.eliminated.length === 0 ? (
                <p style={{ marginTop: '20px', fontWeight: 500, color: 'var(--on-surface-variant)' }}>Доминируемых стратегий не обнаружено.</p>
              ) : (
                <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {domResult.eliminated.map((msg, i) => {
                    const translated = msg
                      .replace('Row', 'Строка')
                      .replace('Column', 'Столбец')
                      .replace('eliminated', 'исключена')
                      .replace('dominated by', 'доминируется');
                    return (
                      <div key={i} style={{ padding: '16px', background: 'var(--surface-container-low)', borderRadius: '12px', color: 'var(--tertiary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <TrendingDown size={18} />
                        {translated}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="surface-card-inner" style={{ padding: '32px' }}>
              <span className="label-md">Редуцированная Матрица</span>
              <table style={{ marginTop: '24px' }}>
                <thead>
                  <tr>
                    <th></th>
                    {domResult.colLabels.map(j => <th key={j}>B{j+1}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {domResult.reducedMatrix.map((row, i) => (
                    <tr key={i}>
                      <th style={{ fontSize: '0.75rem' }}>A{domResult.rowLabels[i] + 1}</th>
                      {row.map((val, j) => (
                         <td key={j} style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--primary)' }}>{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>

        {/* Шаг 4: Графический метод */}
        <motion.section {...fadeInUp} className="surface-card" style={{ marginBottom: '80px' }}>
          <div style={{ marginBottom: '40px' }}>
            <div className="label-md" style={{ marginBottom: '8px' }}>Шаг 4</div>
            <h3>Графоаналитический Метод</h3>
            <p>Визуализация ожидаемого выигрыша Игрока А в зависимости от вероятностного распределения.</p>
          </div>
          
          <div className="surface-card-inner" style={{ height: '500px', width: '100%', marginBottom: '40px' }}>
            <Line ref={chartRef} data={chartData} options={chartOptions as any} />
          </div>
          
          {mixedResult ? (
            <div className="info-block grid grid-cols-3 text-center" style={{ padding: '32px' }}>
              <div>
                <span className="label-md">Оптимальное p* (A1)</span>
                <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', marginTop: '12px', marginBottom: 0 }}>
                  {mixedResult.p.toFixed(3)} <br/>
                  <span style={{ fontSize: '1rem', color: 'var(--outline)', fontWeight: 600 }}>({(mixedResult.p * 100).toFixed(1)}%)</span>
                </p>
              </div>
              <div style={{ borderLeft: '1px solid var(--surface-container-highest)', borderRight: '1px solid var(--surface-container-highest)' }}>
                <span className="label-md">Оптимальное q* (B1)</span>
                <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', marginTop: '12px', marginBottom: 0 }}>
                   {mixedResult.q.toFixed(3)}
                </p>
              </div>
              <div>
                <span className="label-md">Цена Игры (v)</span>
                <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--success)', marginTop: '12px', marginBottom: 0 }}>
                   {mixedResult.v.toFixed(3)}
                </p>
              </div>
            </div>
          ) : (
            <div className="info-block text-center" style={{ padding: '32px', color: 'var(--warning)', fontWeight: 600, fontSize: '1.25rem' }}>
              <Zap size={24} style={{ display: 'block', margin: '0 auto 12px' }} />
              Графический расчет требует матрицы 2xM. Используйте доминирование или численные методы.
            </div>
          )}
        </motion.section>

        {/* Шаг 5: Продвинутые методы */}
        <motion.section {...fadeInUp} style={{ marginBottom: '120px' }}>
          <div className="grid grid-cols-2">
            <div className="surface-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '40px' }}>
                <div className="label-md" style={{ marginBottom: '8px' }}>Шаг 5.1</div>
                <h3>Симплекс-Оптимизация</h3>
                <p>Решение через задачу линейного программирования.</p>
              </div>
              
              <div className="surface-card-inner" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
                <span className="label-md">Точная цена игры</span>
                <p style={{ fontSize: '4rem', fontWeight: 900, color: 'var(--success)', margin: '20px 0' }}>
                  {exactPrice}
                </p>
                
                {mixedResult && (
                  <div style={{ marginBottom: '32px' }}>
                     <span className="label-md">Вектор Стратегий p(A)</span>
                     <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--on-surface-variant)', marginTop: '12px' }}>
                       [{mixedResult.p.toFixed(3)}, {(1-mixedResult.p).toFixed(3)}]
                     </p>
                  </div>
                )}
                
                <button className="btn btn-primary" onClick={handleExportLP} style={{ width: '100%', padding: '16px' }}>Экспорт LP Отчета</button>
              </div>
            </div>

            <div className="surface-card">
              <div style={{ marginBottom: '40px' }}>
                <div className="label-md" style={{ marginBottom: '8px' }}>Шаг 5.2</div>
                <h3>Метод Брауна-Робинсона</h3>
                <p>Итерационное приближение (1000 циклов симуляции).</p>
              </div>
              
              <div className="surface-card-inner" style={{ padding: '0', overflow: 'hidden', marginBottom: '32px' }}>
                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <table style={{ margin: 0, borderSpacing: 0 }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', zIndex: 10 }}>
                      <tr>
                        <th style={{ padding: '16px', borderBottom: '1px solid var(--surface-container)' }}>Итер.</th>
                        <th style={{ padding: '16px', borderBottom: '1px solid var(--surface-container)' }}>Нижняя</th>
                        <th style={{ padding: '16px', borderBottom: '1px solid var(--surface-container)' }}>Верхняя</th>
                        <th style={{ padding: '16px', borderBottom: '1px solid var(--surface-container)' }}>Средняя</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brResult.history.map((h, i) => (
                         <tr key={i} style={{ borderBottom: '1px solid var(--surface-container-low)' }}>
                           <td style={{ color: 'var(--outline)', fontWeight: 500, padding: '12px' }}>{h.iter}</td>
                           <td style={{ color: 'var(--warning)', fontWeight: 700 }}>{h.vMin.toFixed(2)}</td>
                           <td style={{ color: 'var(--success)', fontWeight: 700 }}>{h.vMax.toFixed(2)}</td>
                           <td style={{ color: 'var(--primary)', fontWeight: 800 }}>{h.vAvg.toFixed(3)}</td>
                         </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="grid grid-cols-2 text-center" style={{ gap: '20px' }}>
                <div className="info-block" style={{ padding: '20px' }}>
                  <span className="label-md">Приближенное v</span>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--warning)', marginTop: '12px', marginBottom: 0 }}>
                    {brResult.vApprox.toFixed(3)}
                  </p>
                </div>
                <div className="info-block" style={{ padding: '20px' }}>
                  <span className="label-md">Погрешность</span>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--on-surface-variant)', marginTop: '12px', marginBottom: 0 }}>
                    {Math.abs(exactPrice - brResult.vApprox).toFixed(4)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Финальный блок */}
        <motion.div 
          className="surface-card" 
          style={{ background: 'var(--surface-container-low)', padding: '60px', textAlign: 'center', border: '2px solid white' }}
          {...fadeInUp}
        >
          <h3 style={{ fontSize: '2.5rem', marginBottom: '24px' }}>Анализ завершен</h3>
          <p style={{ maxWidth: '600px', margin: '0 auto 40px' }}>Все вычисления проведены согласно математической модели фон Неймана-Моргенштерна. Вы можете экспортировать полные результаты или изменить вводные данные выше.</p>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={handleDownloadPDF} style={{ padding: '16px 40px' }}>Загрузить PDF</button>
            <button className="btn btn-primary" style={{ padding: '16px 40px' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              Начать Заново
              <ArrowRight size={18} />
            </button>
          </div>
        </motion.div>

        <footer style={{ marginTop: '80px', paddingBottom: '40px', opacity: 0.5, textAlign: 'center', fontSize: '0.75rem' }}>
          © 2024 Stitch Pro • Теория Игр • Вариант 17
        </footer>
      </main>
    </div>
  );
}

export default App;
