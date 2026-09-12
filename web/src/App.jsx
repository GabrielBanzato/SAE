import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import Dashboard from './pages/Dashboard';
import Vendas from './pages/Vendas';
import Produtos from './pages/Produtos';
import CalculadoraPrecificacao from './pages/CalculadoraPrecificacao';
import Estoque from './pages/Estoque';
import Clientes from './pages/Clientes';
import Lancamentos from './pages/Lancamentos';
import ControleFinanceiro from './pages/ControleFinanceiro';
import Notas from './pages/Notas';
import Agenda from './pages/Agenda';
import Relatorios from './pages/Relatorios';
import Configuracoes from './pages/Configuracoes';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Publicas - nao passam pelo PrivateRoute. */}
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />

        {/* Tudo daqui pra baixo exige sessao ativa (ver PrivateRoute). */}
        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/vendas" element={<Vendas />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/precificacao" element={<CalculadoraPrecificacao />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/lancamentos" element={<Lancamentos />} />
            <Route path="/financeiro" element={<ControleFinanceiro />} />
            <Route path="/notas" element={<Notas />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
