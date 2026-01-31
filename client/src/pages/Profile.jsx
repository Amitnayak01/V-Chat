import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function Profile() {
  const [username, setUsername] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("token");
      const res = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsername(res.data.username);
    };
    fetchUser();
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    nav("/");
  };

  return (
    <div className="center">
      <h2>Profile</h2>
      <h3 style={{ margin: "15px 0" }}>Username: {username}</h3>

      <button onClick={logout} style={{ background: "red" }}>
        Logout
      </button>
    </div>
  );
}
