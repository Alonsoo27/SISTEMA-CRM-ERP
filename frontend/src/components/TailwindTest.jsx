export default function TailwindTest() {
  return (
    <div className="bg-red-500 p-4 text-white rounded-lg m-4 border-2 border-blue-300">
      <h1 className="text-2xl font-bold mb-2">🔴 TEST TAILWIND CSS</h1>
      <p className="mt-2 text-lg">Si ves este texto en rojo con bordes azules, Tailwind funciona ✅</p>
      <p className="text-sm mt-1 opacity-75">Si está sin estilos (texto negro, sin fondo), Tailwind NO funciona ❌</p>
      <div className="mt-4 flex gap-2">
        <div className="bg-green-500 p-2 rounded">Verde</div>
        <div className="bg-blue-500 p-2 rounded">Azul</div>
        <div className="bg-yellow-500 p-2 rounded text-black">Amarillo</div>
      </div>
    </div>
  );
}
