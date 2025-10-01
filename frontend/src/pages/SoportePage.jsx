import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Importar componentes de las 4 secciones principales
import SoporteDashboard from '../components/soporte/SoporteDashboard';
import TicketsSection from '../components/soporte/sections/TicketsSection';
import ProgramacionSection from '../components/soporte/sections/ProgramacionSection';
import AnalisisSection from '../components/soporte/sections/AnalisisSection';

const SoportePage = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="h-full p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header del módulo */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            🛠️ Módulo de Soporte Técnico
          </h1>
          <p className="text-gray-600">
            Gestión integral de tickets, productos en reparación y capacitaciones
          </p>
        </div>

        {/* Sistema de tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <span>📊</span>
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <span>🎫</span>
              Gestión de Casos
            </TabsTrigger>
            <TabsTrigger value="programacion" className="flex items-center gap-2">
              <span>📋</span>
              Programación
            </TabsTrigger>
            <TabsTrigger value="analisis" className="flex items-center gap-2">
              <span>📈</span>
              Análisis y Control
            </TabsTrigger>
          </TabsList>

          {/* Contenido de cada tab */}
          <TabsContent value="dashboard" className="mt-0">
            <SoporteDashboard />
          </TabsContent>

          <TabsContent value="tickets" className="mt-0">
            <TicketsSection />
          </TabsContent>

          <TabsContent value="programacion" className="mt-0">
            <ProgramacionSection />
          </TabsContent>

          <TabsContent value="analisis" className="mt-0">
            <AnalisisSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SoportePage;