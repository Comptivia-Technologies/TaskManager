const LoadingSpinner = () => {
  return (
    <div className="flex justify-center items-center h-64">
      <div className="relative">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#434E78]/20"></div>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#434E78] absolute top-0 left-0"></div>
      </div>
    </div>
  );
};

export default LoadingSpinner;



