import { createContext, useState, useEffect } from "react";
import axios from "axios";

export const UserContext = createContext(null);

const serverUrl = "http://localhost:3000";
const TOKEN_KEY = "spyder-token";

export const UserContextProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setLoading(false);
      return;
    }

    axios
      .get(`${serverUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((response) => {
        setUser(response.data.user || null);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = (authPayload) => {
    if (!authPayload?.token || !authPayload?.user) return;
    localStorage.setItem(TOKEN_KEY, authPayload.token);
    setUser(authPayload.user);
  };

  const loginWithToken = async (token) => {
    if (!token) {
      throw new Error("Missing auth token");
    }

    localStorage.setItem(TOKEN_KEY, token);

    try {
      const response = await axios.get(`${serverUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUser(response.data.user || null);
      return response.data.user || null;
    } catch (error) {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return {};

    return {
      Authorization: `Bearer ${token}`,
    };
  };

  return (
    <UserContext.Provider value={{ user, setUser, loading, login, loginWithToken, logout, getAuthHeaders, serverUrl }}>
      {children}
    </UserContext.Provider>
  );
};
