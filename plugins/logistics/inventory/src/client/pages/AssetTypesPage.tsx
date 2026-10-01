import { useState, type FormEvent } from "react";
import { Button, Card, ErrorState, Field, Input, Loading, useAsync } from "@eops/ui";
import { inventoryService } from "../services/inventoryService";
import styles from "../styles/inventory.module.css";

export function AssetTypesPage() {
  const { data, loading, error, reload } = useAsync(inventoryService.types, []); const [key, setKey] = useState(""); const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [savingError, setSavingError] = useState<unknown>();
  async function submit(event: FormEvent) { event.preventDefault(); setSavingError(undefined); try { await inventoryService.createType({ key, name, description: description || undefined }); setKey(""); setName(""); setDescription(""); reload(); } catch (cause) { setSavingError(cause); } }
  return <section className={styles.page}><h1>Tipos de ativos</h1>{loading && <Loading />}{error && <ErrorState error={error} onRetry={reload} />}{savingError !== undefined && <ErrorState error={savingError} />}<div className={styles.detailGrid}><Card><h2>Novo tipo</h2><form className={styles.actions} onSubmit={(event) => void submit(event)}><Field label="Chave"><Input required value={key} onChange={(event) => setKey(event.target.value)} /></Field><Field label="Nome"><Input required value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="Descrição"><Input value={description} onChange={(event) => setDescription(event.target.value)} /></Field><Button type="submit">Cadastrar tipo</Button></form></Card><Card><h2>Tipos configurados</h2><ul className={styles.types}>{data?.map((type) => <li key={type.id}><strong>{type.name}</strong><span>{type.key}</span><small>{type.active ? "Ativo" : "Inativo"}</small></li>)}</ul></Card></div></section>;
}
