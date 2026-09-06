import { useRef } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppState } from "../state/AppStateContext";
import { useAuth } from "../state/AuthContext";
import { exportStateJson } from "../lib/io/exportStateJson";
import { importStateJson } from "../lib/io/importStateJson";
import { Button } from "./ui/Button";

export function Nav() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { auth } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    exportStateJson(state);
    dispatch({ type: "MARK_SAVED" });
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (state.meta.isDirty && !confirm("現在の未保存データは失われます。読み込みますか？")) return;
    try {
      const imported = await importStateJson(file);
      dispatch({ type: "IMPORT_STATE", state: imported });
    } catch {
      alert("ファイルの読み込みに失敗しました。「保存(ファイル)」で保存したファイルを選択してください。");
    }
  }

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/" className="text-lg font-bold text-zinc-900">
            シフト作成
          </Link>
          <nav className="flex flex-wrap gap-1 text-base text-zinc-600">
            <Link to="/" className="rounded-md px-3 py-1.5 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
              TOP
            </Link>
            <Link to="/employees" className="rounded-md px-3 py-1.5 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
              従業員
            </Link>
            <Link to="/settings" className="rounded-md px-3 py-1.5 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
              設定
            </Link>
            <Link to="/account" className="rounded-md px-3 py-1.5 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
              アカウント
              {auth.status === "signed-in" && (
                <span className={`ml-1 text-sm ${auth.plan === "paid" ? "text-blue-600" : "text-zinc-400"}`}>
                  ({auth.plan === "paid" ? "有料" : "無料"})
                </span>
              )}
            </Link>
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state.meta.isDirty && (
            <span
              className="text-sm text-amber-600"
              title="「保存(ファイル)」を押しておくと、ブラウザを閉じても「読み込み」から続きを再開できます。"
            >
              未保存の変更があります（保存で閉じても安心）
            </span>
          )}
          <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
            読み込み
          </Button>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
          <Button type="button" onClick={handleExport}>
            保存(ファイル)
          </Button>
        </div>
      </div>
    </header>
  );
}
