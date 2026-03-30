export default function Table({ children, className = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-[640px]">{children}</table>
    </div>
  );
}
