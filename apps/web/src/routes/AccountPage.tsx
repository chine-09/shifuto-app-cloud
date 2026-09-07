import { useRef, useState } from "react";
import { useAuth } from "../state/AuthContext";
import { useAppState } from "../state/AppStateContext";
import { useCloudSync } from "../state/CloudSyncContext";
import { createCheckoutSession } from "../lib/api/cloudStateClient";
import { exportStateJson } from "../lib/io/exportStateJson";
import { importStateJson } from "../lib/io/importStateJson";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

type Mode = "signIn" | "signUp" | "confirm";

export function AccountPage() {
  const { auth, signUp, confirmSignUp, resendConfirmationCode, signIn, signOut, refreshPlan } = useAuth();
  const state = useAppState();
  const { status: syncStatus, conflictUpdatedAt, overwriteCloudWithLocal, discardLocalAndUseCloud, restoreFromFile } =
    useCloudSync();
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signUp(email, password);
      setMode("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await confirmSignUp(email, code);
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "確認コードが正しくありません。");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "メールアドレスまたはパスワードが正しくありません。");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpgrade() {
    if (auth.status !== "signed-in") return;
    setError(null);
    setBusy(true);
    try {
      const { url } = await createCheckoutSession(auth.idToken);
      window.location.href = url;
    } catch {
      setError("決済ページの起動に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  async function handleOverwriteCloud() {
    if (!confirm("他の端末・タブで保存された内容を、この端末の内容で上書きします。よろしいですか？")) return;
    setError(null);
    setBusy(true);
    try {
      await overwriteCloudWithLocal();
    } finally {
      setBusy(false);
    }
  }

  async function handleDiscardLocal() {
    if (!confirm("この端末での変更を破棄して、他の端末・タブで保存された内容を読み込みます。よろしいですか？")) return;
    setError(null);
    setBusy(true);
    try {
      await discardLocalAndUseCloud();
    } finally {
      setBusy(false);
    }
  }

  function handleBackupToFile() {
    // A plain backup copy — not tied to the cloud save/dirty flag, so this
    // never risks marking pending cloud changes as clean.
    exportStateJson(state);
  }

  async function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!confirm("現在のデータ（クラウド上の保存内容を含む）を、選択したファイルの内容で置き換えます。よろしいですか？")) return;
    setError(null);
    setBusy(true);
    try {
      const imported = await importStateJson(file);
      await restoreFromFile(imported);
    } catch {
      setError("ファイルの読み込みに失敗しました。「バックアップをダウンロード」で保存したファイルを選択してください。");
    } finally {
      setBusy(false);
    }
  }

  if (auth.status === "loading") {
    return <p className="text-sm text-zinc-500">読み込み中...</p>;
  }

  if (auth.status === "signed-in") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-zinc-900">アカウント</h1>

        <section className="card p-3">
          <p className="text-sm text-zinc-600">{auth.email}</p>
          <p className="mt-1 text-sm text-zinc-600">
            現在のプラン：
            <span className={`ml-1 font-semibold ${auth.plan === "paid" ? "text-blue-700" : "text-zinc-700"}`}>
              {auth.plan === "paid" ? "有料プラン（クラウド自動保存 有効）" : "無料プラン"}
            </span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {auth.plan === "free" && (
              <Button type="button" onClick={handleUpgrade} disabled={busy}>
                有料プランにアップグレード
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={refreshPlan} disabled={busy}>
              プラン状態を再確認
            </Button>
            <Button type="button" variant="secondary" onClick={signOut}>
              ログアウト
            </Button>
          </div>
        </section>

        {auth.plan === "paid" && syncStatus === "conflict" && (
          <section className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <h2 className="mb-1 text-base font-semibold text-amber-800">別の端末・タブでの保存と競合しています</h2>
            <p className="mb-2 text-sm text-amber-700">
              このアカウントの別の場所（別タブや別端末）で、この端末より新しい内容が保存されています
              {conflictUpdatedAt && `（保存日時: ${new Date(conflictUpdatedAt).toLocaleString("ja-JP")}）`}。
              自動保存は一時停止しています。どちらを残すか選んでください。
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={handleOverwriteCloud} disabled={busy}>
                この端末の内容で上書き保存する
              </Button>
              <Button type="button" variant="secondary" onClick={handleDiscardLocal} disabled={busy}>
                この端末の変更を破棄して読み込む
              </Button>
            </div>
          </section>
        )}

        {auth.plan === "paid" && (
          <section className="card p-3">
            <h2 className="mb-1 text-base font-semibold text-zinc-700">クラウド自動保存</h2>
            <p className="text-sm text-zinc-500">
              サインインすると保存済みのデータが自動で読み込まれ、変更するたびに自動でクラウドに保存されます（読み込み・保存ボタンは不要です）。
              {syncStatus === "saving" && " 保存中..."}
              {syncStatus === "saved" && " ✓ 保存済み"}
              {syncStatus === "error" && " 保存に失敗しました。ネットワーク接続を確認してください。"}
              {syncStatus === "conflict" && " ⚠ 競合のため一時停止中です（上の案内をご確認ください）。"}
            </p>
          </section>
        )}

        {auth.plan === "paid" && (
          <section className="card p-3">
            <h2 className="mb-1 text-base font-semibold text-zinc-700">バックアップ</h2>
            <p className="mb-2 text-sm text-zinc-500">
              手元にJSONファイルとして控えておいたり、無料プラン時代のデータや別のバックアップから復元したい場合はこちら。
              復元すると、内容はそのままクラウドにも自動で反映されます。
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={handleBackupToFile} disabled={busy}>
                バックアップをダウンロード
              </Button>
              <Button type="button" variant="secondary" onClick={() => restoreFileInputRef.current?.click()} disabled={busy}>
                ファイルから復元
              </Button>
              <input
                ref={restoreFileInputRef}
                type="file"
                accept="application/json"
                hidden
                onChange={handleRestoreFile}
              />
            </div>
          </section>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-zinc-900">アカウント</h1>
      <p className="text-sm text-zinc-500">
        無料プランはアカウント登録なしでそのまま使えます。有料プラン（クラウド自動保存）を使う場合のみ、ここから登録・ログインしてください。
      </p>

      <section className="max-w-sm card p-4">
        {mode !== "confirm" && (
          <div className="mb-3 flex gap-2 text-sm">
            <button
              type="button"
              onClick={() => setMode("signIn")}
              className={`rounded-md px-2 py-1 ${mode === "signIn" ? "bg-blue-50 text-blue-700" : "text-zinc-500"}`}
            >
              ログイン
            </button>
            <button
              type="button"
              onClick={() => setMode("signUp")}
              className={`rounded-md px-2 py-1 ${mode === "signUp" ? "bg-blue-50 text-blue-700" : "text-zinc-500"}`}
            >
              新規登録
            </button>
          </div>
        )}

        {mode === "signIn" && (
          <form onSubmit={handleSignIn} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-zinc-500">
              メールアドレス
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-500">
              パスワード
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <Button type="submit" disabled={busy}>
              ログイン
            </Button>
          </form>
        )}

        {mode === "signUp" && (
          <form onSubmit={handleSignUp} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-zinc-500">
              メールアドレス
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-500">
              パスワード（8文字以上）
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>
            <Button type="submit" disabled={busy}>
              登録する
            </Button>
          </form>
        )}

        {mode === "confirm" && (
          <form onSubmit={handleConfirm} className="flex flex-col gap-3">
            <p className="text-sm text-zinc-600">{email} に届いた確認コードを入力してください。</p>
            <label className="flex flex-col gap-1 text-sm text-zinc-500">
              確認コード
              <Input type="text" value={code} onChange={(e) => setCode(e.target.value)} required />
            </label>
            <Button type="submit" disabled={busy}>
              確認する
            </Button>
            <button
              type="button"
              className="text-sm text-blue-700 hover:underline"
              onClick={() => resendConfirmationCode(email)}
            >
              確認コードを再送する
            </button>
          </form>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>
    </div>
  );
}
