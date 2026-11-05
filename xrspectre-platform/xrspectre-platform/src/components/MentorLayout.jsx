import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Users, LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './MentorLayout.css';
import BrandMark from './BrandMark';

export default function MentorLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="mlayout">
      <aside className="mlayout__sidebar">
        <div className="mlayout__brand">
          <span className="mlayout__logo"><BrandMark size={17} /></span>
          <div className="mlayout__brand-text">
            <span>XRSpectre</span>
            <span className="mlayout__tagline">Deconstruct your code down to silicon</span>
          </div>
        </div>
        <nav className="mlayout__nav">
          <NavLink to="/mentor/students" className="mlayout__link" end>
            <Users size={16} />
            My students
          </NavLink>
        </nav>
        <div className="mlayout__footer">
          {user && (
            <div className="mlayout__user-card">
              <div className="mlayout__avatar">{user.name?.charAt(0)?.toUpperCase() || <User size={14} />}</div>
              <div className="mlayout__user-info">
                <span className="mlayout__user-name">{user.name || user.email}</span>
                <span className="mlayout__user-role">Mentor</span>
              </div>
            </div>
          )}
          <button className="mlayout__logout" onClick={handleLogout}>
            <LogOut size={14} /> Log out
          </button>
        </div>
      </aside>
      <main className="mlayout__main">
        <Outlet />
      </main>
    </div>
  );
}
