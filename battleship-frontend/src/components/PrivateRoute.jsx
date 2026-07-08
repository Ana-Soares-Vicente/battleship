import { Navigate } from 'react-router-dom';

export default function PrivateRoute({ children }) {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    
    if (!token || !username) {
        return <Navigate to="/" replace />;
    }
    
    return children;
}
