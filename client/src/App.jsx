import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VideoCall from "./pages/VideoCall";
import React from "react";
import Profile from "./pages/Profile";


const PrivateRoute = ({ children }) =>
  localStorage.getItem("token") ? children : <Navigate to="/" />;

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/call" element={<PrivateRoute><VideoCall /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
