import React, { useState, useEffect } from "react";
import { UserPlus, X, User, Loader } from "lucide-react";
import api from "../api";

export default function AddToCallPopup({ 
  isOpen, 
  onClose, 
  onAddUser, 
  currentCallUserId,
  socket 
}) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [userDetails, setUserDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const currentUserId = localStorage.getItem("userId");
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!isOpen) return;

    // Listen for online users updates
    const handleOnlineUsers = (users) => {
      // Filter out current user and user already in call
      const filtered = users.filter(
        (id) => id !== currentUserId && id !== currentCallUserId
      );
      setOnlineUsers(filtered);
      fetchUserDetails(filtered);
    };

    socket.on("online-users", handleOnlineUsers);
    socket.emit("get-online-users");

    return () => {
      socket.off("online-users", handleOnlineUsers);
    };
  }, [isOpen, socket, currentUserId, currentCallUserId]);

  const fetchUserDetails = async (userIds) => {
    setLoading(true);
    const details = {};
    
    try {
      await Promise.all(
        userIds.map(async (userId) => {
          try {
            const res = await api.get(`/auth/user/${userId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            details[userId] = res.data;
          } catch (err) {
            console.error(`Failed to fetch user ${userId}:`, err);
          }
        })
      );
      setUserDetails(details);
    } catch (err) {
      console.error("Error fetching user details:", err);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (profilePic) => {
    if (!profilePic) return null;
    if (profilePic.startsWith('http://') || profilePic.startsWith('https://')) {
      return profilePic;
    }
    const baseUrl = 'https://v-chat-itn7.onrender.com';
    const cleanPath = profilePic.startsWith('/') ? profilePic : `/${profilePic}`;
    return `${baseUrl}${cleanPath}`;
  };

  const filteredUsers = onlineUsers.filter((userId) => {
    const user = userDetails[userId];
    if (!user) return false;
    return user.username.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (!isOpen) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <UserPlus size={24} color="#3b82f6" />
            <h2 style={titleStyle}>Add to Call</h2>
          </div>
          <button onClick={onClose} style={closeButtonStyle}>
            <X size={24} color="#fff" />
          </button>
        </div>

        {/* Search Bar */}
        <div style={searchContainerStyle}>
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={searchInputStyle}
            autoFocus
          />
        </div>

        {/* User List */}
        <div style={userListStyle}>
          {loading ? (
            <div style={loadingStyle}>
              <Loader size={32} color="#3b82f6" style={{ animation: "spin 1s linear infinite" }} />
              <p style={{ color: "#888", marginTop: "12px" }}>Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={emptyStateStyle}>
              <User size={48} color="#555" />
              <p style={{ color: "#888", marginTop: "12px" }}>
                {searchQuery ? "No users found" : "No available users to add"}
              </p>
            </div>
          ) : (
            filteredUsers.map((userId) => {
              const user = userDetails[userId];
              if (!user) return null;

              const profileImageUrl = getImageUrl(user.profilePic);

              return (
                <div
                  key={userId}
                  style={userItemStyle}
                  onClick={() => onAddUser(userId, user.username)}
                >
                  {/* Avatar */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                    {profileImageUrl ? (
                      <img
                        src={profileImageUrl}
                        alt={user.username}
                        style={avatarStyle}
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextElementSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      style={{
                        ...avatarPlaceholderStyle,
                        display: profileImageUrl ? "none" : "flex"
                      }}
                    >
                      {user.username.charAt(0).toUpperCase()}
                    </div>

                    {/* User Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={usernameStyle}>{user.username}</p>
                      {user.bio && (
                        <p style={bioStyle}>
                          {user.bio.length > 40 ? `${user.bio.substring(0, 40)}...` : user.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Add Button */}
                  <button style={addButtonStyle}>
                    <UserPlus size={18} color="#fff" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Styles
const overlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.8)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  backdropFilter: "blur(8px)",
  animation: "fadeIn 0.2s ease"
};

const modalStyle = {
  background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
  borderRadius: "20px",
  width: "90%",
  maxWidth: "500px",
  maxHeight: "80vh",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.6)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  animation: "slideUp 0.3s ease"
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "24px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
};

const titleStyle = {
  margin: 0,
  fontSize: "20px",
  fontWeight: "600",
  color: "#fff"
};

const closeButtonStyle = {
  background: "rgba(255, 255, 255, 0.1)",
  border: "none",
  borderRadius: "50%",
  width: "40px",
  height: "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.2s ease"
};

const searchContainerStyle = {
  padding: "16px 24px"
};

const searchInputStyle = {
  width: "100%",
  padding: "12px 16px",
  background: "rgba(255, 255, 255, 0.05)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "10px",
  color: "#fff",
  fontSize: "14px",
  outline: "none",
  transition: "all 0.2s ease"
};

const userListStyle = {
  flex: 1,
  overflowY: "auto",
  padding: "0 24px 24px",
  minHeight: "200px"
};

const userItemStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px",
  background: "rgba(255, 255, 255, 0.03)",
  borderRadius: "12px",
  marginBottom: "8px",
  cursor: "pointer",
  transition: "all 0.2s ease",
  border: "1px solid transparent"
};

const avatarStyle = {
  width: "48px",
  height: "48px",
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid rgba(59, 130, 246, 0.3)"
};

const avatarPlaceholderStyle = {
  width: "48px",
  height: "48px",
  borderRadius: "50%",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "20px",
  fontWeight: "bold",
  color: "#fff"
};

const usernameStyle = {
  margin: 0,
  fontSize: "16px",
  fontWeight: "500",
  color: "#fff",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const bioStyle = {
  margin: "4px 0 0 0",
  fontSize: "13px",
  color: "#888",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const addButtonStyle = {
  background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
  border: "none",
  borderRadius: "50%",
  width: "40px",
  height: "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.2s ease",
  flexShrink: 0
};

const loadingStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "200px"
};

const emptyStateStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "200px",
  textAlign: "center"
};