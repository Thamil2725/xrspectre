import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ListChecks, PlusSquare, ShieldCheck, ShieldPlus, LogOut, Building2, Database, Users, User, GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './AdminLayout.css';
import BrandMark from './BrandMark';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="alayout">
      <aside className="alayout__sidebar">
        <div className="alayout__brand">
          <span className="alayout__logo"><BrandMark size={17} /></span>
          <div className="alayout__brand-text">
            <span>XRSpectre</span>
            <span className="alayout__tagline">Deconstruct your code down to silicon</span>
          </div>
        </div>
        <nav className="alayout__nav">
          <NavLink to="/admin/tests" className="alayout__link" end>
            <ListChecks size={16} />
            All tests
          </NavLink>
          <NavLink to="/admin/create" className="alayout__link">
            <PlusSquare size={16} />
            Create test
          </NavLink>
          <NavLink to="/admin/organizations" className="alayout__link">
            <Building2 size={16} />
            Organizations
          </NavLink>
          <NavLink to="/admin/pools" className="alayout__link">
            <Database size={16} />
            Question pools
          </NavLink>
          <NavLink to="/admin/students" className="alayout__link">
            <Users size={16} />
            Students
          </NavLink>
          <NavLink to="/admin/admins" className="alayout__link">
            <ShieldPlus size={16} />
            Admins
          </NavLink>
          <NavLink to="/admin/mentors" className="alayout__link">
            <GraduationCap size={16} />
            Mentors
          </NavLink>
        </nav>
        <div className="alayout__footer">
          {user && (
            <div className="alayout__user-card">
              <div className="alayout__avatar">{user.name?.charAt(0)?.toUpperCase() || <User size={14} />}</div>
              <div className="alayout__user-info">
                <span className="alayout__user-name">{user.name || user.email}</span>
                <span className="alayout__user-role">{user.role}</span>
              </div>
            </div>
          )}
          <button className="alayout__logout" onClick={handleLogout}>
            <LogOut size={14} /> Log out
          </button>
        </div>
      </aside>
      <main className="alayout__main">
        <Outlet />
      </main>
    </div>
  );
}
