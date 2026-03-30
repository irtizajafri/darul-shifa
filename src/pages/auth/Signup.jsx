import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import toast from 'react-hot-toast';
import './Login.scss'; // Same layout as Login

export default function Signup() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();
  const password = watch('password');

  const onSubmit = async (data) => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    console.log('Signup data:', data);
    toast.success('Account created successfully! Please login.');
    navigate('/login');
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <Building2 className="login-icon" />
        <h1>Darul Shifa Imam Khomeini</h1>
        <p>Hospital Management System</p>
        {/* <span className="login-version">v1.0</span> */}
      </div>
      <div className="login-right">
        <div className="login-card">
          <h2>Create Account</h2>
          <p className="login-subtitle">Sign up for a new account</p>
          <form onSubmit={handleSubmit(onSubmit)} className="login-form">
            <Input
              label="Full Name"
              placeholder="Enter your full name"
              error={errors.fullName?.message}
              {...register('fullName', { required: 'Full name is required' })}
            />
            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
              error={errors.email?.message}
              {...register('email', { required: 'Email is required' })}
            />
            <Input
              label="Password"
              type="password"
              placeholder="Create a password"
              error={errors.password?.message}
              {...register('password', { required: 'Password is required', minLength: 6 })}
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Confirm your password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword', {
                required: 'Please confirm password',
                validate: (v) => v === password || 'Passwords do not match',
              })}
            />
            <Button type="submit" label="Sign Up" fullWidth loading={loading} className="login-btn" />
          </form>
        </div>
        <p className="login-signup">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
