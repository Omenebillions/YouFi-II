import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { Home, Repeat, Target, MessageCircle, Plus, Menu, X, ArrowDown, CreditCard, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { user, userProfile, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] w-full bg-[#f8f9fc] max-w-md mx-auto relative overflow-hidden shadow-2xl sm:rounded-[40px] sm:h-[90vh] sm:my-[5vh] sm:border-[8px] sm:border-black flex-col">
      <main className="flex-1 overflow-y-auto w-full pb-24 hide-scrollbar relative z-0">
        <Outlet />
      </main>
      
      {/* Global Hamburger Menu Button */}
      <button 
         onClick={() => setDrawerOpen((prev) => !prev)}
         className="absolute top-[48px] right-6 z-40 w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95"
      >
        <Menu size={18} />
      </button>

      {/* Global Drawer */}
      <div 
         className={`absolute inset-y-0 right-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-6 h-full flex flex-col pt-12">
          <div className="flex items-center justify-between mb-8">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                 {user?.photoURL ? <img src={user.photoURL} alt="User" /> : <div className="text-gray-400 font-bold">{userProfile?.name?.charAt(0) || 'U'}</div>}
               </div>
               <div>
                  <h3 className="font-bold text-gray-900">{userProfile?.name || 'User'}</h3>
               </div>
             </div>
             <button onClick={() => setDrawerOpen(false)} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                <X size={20} className="text-gray-600" />
             </button>
          </div>
          
          <nav className="flex flex-col gap-4 flex-1">
             <Link to="/profile" className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                <Settings size={20} className="text-gray-500" />
                <span>Settings</span>
             </Link>
             <Link to="/history/income" className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                <ArrowDown size={20} className="rotate-180 text-brand-600" />
                <span>Income History</span>
             </Link>
             <Link to="/history/expense" className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                <ArrowDown size={20} className="text-orange-500" />
                <span>Expense History</span>
             </Link>
             <Link to="/history/debt" className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                <CreditCard size={20} className="text-red-500" />
                <span>Debt History</span>
             </Link>
          </nav>
          
          <div className="mt-auto pt-6 border-t border-gray-100">
             <button 
               onClick={() => {
                 setDrawerOpen(false);
                 logout();
                 navigate('/login');
               }}
               className="flex items-center gap-4 text-danger-500 font-bold hover:bg-red-50 p-3 rounded-xl w-full transition-colors"
             >
                <LogOut size={20} />
                <span>Log Out</span>
             </button>
          </div>
        </div>
      </div>
      
      {/* Global Drawer Overlay */}
      {drawerOpen && (
        <div 
          className="absolute inset-0 bg-black/20 z-40" 
          onClick={() => setDrawerOpen(false)}
        />
      )}
      
      {/* Bottom Nav overlay */}
      <nav className="absolute bottom-0 w-full bg-white border-t border-gray-100 rounded-t-3xl flex justify-around items-center px-6 py-4 pb-safe z-30">
        <NavItem to="/" icon={<Home size={22} />} isActive={location.pathname === '/'} />
        <NavItem to="/goals" icon={<Target size={22} />} isActive={location.pathname === '/goals'} />
        
        {/* Floating Add Action */}
        <div className="relative -top-8 flex-shrink-0">
          <NavLink to="/add" className="flex items-center justify-center w-14 h-14 bg-brand-600 rounded-full text-white shadow-[0_8px_20px_-6px_rgba(85,68,232,0.6)] transform transition-transform active:scale-95">
            <Plus size={26} strokeWidth={2.5} />
          </NavLink>
        </div>
        
        <NavItem to="/insights" icon={<Repeat size={22} />} isActive={location.pathname === '/insights'} />
        <NavItem to="/coach" icon={<MessageCircle size={22} />} isActive={location.pathname === '/coach'} />
      </nav>
    </div>
  );
}

function NavItem({ to, icon, isActive }: { to: string; icon: React.ReactNode; isActive: boolean }) {
  return (
    <NavLink 
      to={to} 
      className={`flex items-center justify-center w-12 h-12 transition-colors ${isActive ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}
    >
      {icon}
    </NavLink>
  );
}
