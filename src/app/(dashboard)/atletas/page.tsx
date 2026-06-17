"use client";
import { useState } from "react";
import { useAthletes } from "@/hooks/useAthletes";
import { Card } from "@/shared/components/Card";
import { Header } from "@/shared/components/Header";
import { Badge } from "@/shared/components/Badge";
import { HiOutlineUserPlus, HiOutlinePencilSquare, HiOutlineTrash } from "react-icons/hi2";
import { AthleteFormModal, type AthleteFormData } from "@/features/dashboard/AthleteFormModal";
import type { Athlete } from "@/lib/types";

export default function AtletasPage() {
  const { athletes, loading, addAthlete, updateAthlete, deleteAthlete } = useAthletes();
  const [modal, setModal] = useState<{ open: boolean; editing?: Athlete }>({ open: false });

  function handleSubmit(data: AthleteFormData) {
    if (modal.editing) updateAthlete(modal.editing.id, data);
    else addAthlete(data);
    setModal({ open: false });
  }

  function handleDelete(a: Athlete) {
    if (confirm(`Excluir o atleta "${a.nome}" e todas as suas tentativas? Esta ação não pode ser desfeita.`)) {
      deleteAthlete(a.id);
    }
  }

  return (
    <>
      <Header
        rightSlot={
          <button
            onClick={() => setModal({ open: true })}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold bg-sesi-black text-white hover:bg-sesi-charcoal transition"
          >
            <HiOutlineUserPlus className="w-4 h-4" /> Novo Atleta
          </button>
        }
      />
      <div className="flex-1 p-6 space-y-4 max-w-[1400px] w-full mx-auto">
        <h1 className="text-xl font-semibold">Atletas</h1>
        {loading ? (
          <p className="text-sm text-text-muted">Carregando…</p>
        ) : athletes.length === 0 ? (
          <Card className="border-dashed text-center">
            <p className="text-sm text-text-muted">
              Nenhum atleta cadastrado. Clique em <span className="font-bold text-sesi-red-500">Novo Atleta</span> para começar.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {athletes.map((a) => (
              <Card key={a.id} hoverable>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{a.nome}</h3>
                    <p className="text-xs text-text-muted">{a.numeroAtleta ? `#${a.numeroAtleta}` : "—"}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="primary" size="sm">{a.categoria}</Badge>
                    <button
                      onClick={() => setModal({ open: true, editing: a })}
                      title="Editar"
                      className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-track-50 transition"
                    >
                      <HiOutlinePencilSquare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(a)}
                      title="Excluir"
                      className="p-1.5 rounded-md text-text-muted hover:text-sesi-red-600 hover:bg-sesi-red-50 transition"
                    >
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Ângulo ref</span>
                    <span className="font-medium tabular-nums">{a.referenciaAngulo}°</span>
                  </div>
                  {a.referenciaVelocidade !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Vel. ref</span>
                      <span className="font-medium tabular-nums">{a.referenciaVelocidade.toFixed(1)} m/s</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {modal.open && (
        <AthleteFormModal
          athlete={modal.editing}
          onClose={() => setModal({ open: false })}
          onSubmit={handleSubmit}
        />
      )}
    </>
  );
}
