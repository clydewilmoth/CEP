const OperationPage = () =>{
    const operation = ['Operation 1', 'Operation 2', 'Operation 3', 'Operation 4'];
  
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50">
        <h1 className="text-4xl font-bold mb-8">cep</h1>
        <div className="flex flex-wrap gap-4">
          {operation.map((operation, index) => (
              <div key={index} className="w-40 h-24 flex items-center justify-center border rounded-lg shadow-md hover:shadow-lg transition">
                {operation}
              </div>
          ))}
          <button className="w-40 h-24 flex items-center justify-center border rounded-lg shadow-md hover:shadow-lg transition text-2xl">
            +
          </button>
        </div>
      </main>
    );
  }
  
  export default OperationPage;