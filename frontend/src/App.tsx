import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import Home from './pages/Home'
import JoinLeague from './pages/JoinLeague'
import LeagueDetail from './pages/LeagueDetail'
import PlayerDetail from './pages/PlayerDetail'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route
          path="/join"
          element={
            <ProtectedRoute>
              <JoinLeague />
            </ProtectedRoute>
          }
        />
        <Route
          path="/league/:leagueId"
          element={
            <ProtectedRoute>
              <LeagueDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/player/:leagueId/:playerName"
          element={
            <ProtectedRoute>
              <PlayerDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
       