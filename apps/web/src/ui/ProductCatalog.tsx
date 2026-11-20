import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronRight, Download, PencilLine, Plus } from 'lucide-react';
import { BeautifulButton as Button } from './beautiful/Button';
import {
  PRODUCT_CATALOG_SEED, PRODUCT_CATALOG_VERSION, PRODUCT_CATEGORIES, PRODUCT_MODEL_REGISTRY, addProductFromTemplate, exportProductCatalog, filterProductCatalog, loadProductCatalog,
  saveProductCatalog, updateProductMetadata, type ProductCatalogItem,
} from '../catalog/productCatalog';
import './ProductCatalog.css';
import {SameSkuFillPanel, type SameSkuFillControls} from './SameSkuFillPanel';
import { PlacementTrialPanel, type PlacementTrialControls } from './PlacementTrialPanel';
import { ProductModelPreview } from './ProductModelPreview';
export type {FillPreview, SameSkuFillControls} from './SameSkuFillPanel';

export interface TrialPlacementCounts { [sku: string]: number | undefined }

const EXPORT_NAME = `yh-twinops-product-catalog-v${PRODUCT_CATALOG_VERSION}.json`;

const ZONE_LABELS: Readonly<Record<string, string>> = {
  'zone-packaged':'包装食品区', 'zone-household':'洗化百货区', 'zone-produce':'蔬果区',
  'zone-frozen':'冷冻区', 'zone-daily':'日配冷藏区', 'zone-meat':'生鲜肉类区',
};
type EditableProduct = Pick<ProductCatalogItem, 'name' | 'specification' | 'notes'>;
const editable = ({name, specification, notes}: ProductCatalogItem): EditableProduct => ({name, specification, notes});
type ProductEntry = EditableProduct & {templateSku: string; sku: string};
const emptyEntry = (): ProductEntry => ({
  templateSku: PRODUCT_CATALOG_SEED[0]?.sku ?? '', sku: '', name: '', specification: '', notes: '',
});
const SAVE_ERROR = '此浏览器未能保存。目录未更改，请检查本地存储权限或空间后重试。';
const zoneSummary = (item: ProductCatalogItem) => item.applicableZones.map(zone => ZONE_LABELS[zone] ?? zone).join('、');
const geometryDimensions = (item: ProductCatalogItem) => `${item.referenceSizeMm.join(' × ')} mm`;

function downloadCatalog(products: readonly ProductCatalogItem[]) {
  const blob = new Blob([exportProductCatalog(products)], {type:'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = EXPORT_NAME;
  document.body.append(link);
  try { link.click(); }
  finally {
    link.remove();
    // Allow the browser to resolve the URL before releasing the blob.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function ProductCatalog({trialCounts, catalogItems, onCatalogSaved, placementTrial, ...fillControls}: {
  trialCounts?: TrialPlacementCounts;
  catalogItems?: readonly ProductCatalogItem[];
  onCatalogSaved?: (products: ProductCatalogItem[]) => void;
  placementTrial?: PlacementTrialControls;
} & SameSkuFillControls) {
  const [initial] = useState(() => loadProductCatalog());
  const [storedProducts, setProducts] = useState(initial.products);
  const products = catalogItems ?? storedProducts;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ProductCatalogItem['category']>();
  const [selection, setSelection] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditableProduct | null>(null);
  const [entry, setEntry] = useState<ProductEntry | null>(null);
  const [entryError, setEntryError] = useState('');
  const headerActions = useRef<HTMLDivElement>(null);
  const templateSelect = useRef<HTMLSelectElement>(null);
  const [restore, setRestore] = useState(false);
  const [feedback, setFeedback] = useState<{text:string; error?:boolean} | null>(() =>
    initial.status === 'invalid' || initial.status === 'unavailable'
      ? {text:'未能读取此浏览器保存的目录，已显示原始示意目录。', error:true} : null);
  const visible = filterProductCatalog(products, {query, category});
  const selected = visible.find(product => product.sku === selection) ?? visible[0];
  const entering = entry !== null;
  const template = entry && PRODUCT_CATALOG_SEED.find(product => product.sku === entry.templateSku);
  const originalCount = products.filter(product => !product.templateSku).length;
  const totalPlacements = trialCounts && Object.values(trialCounts).reduce<number>((total, count) => total + (count ?? 0), 0);
  const linkedProducts = trialCounts && products.filter(product => (trialCounts[product.sku] ?? 0) > 0).length;

  useEffect(() => {
    if (entering) templateSelect.current?.focus();
  }, [entering]);

  function persist(next: ProductCatalogItem[], message: string, onFailure = () => setFeedback({text:SAVE_ERROR, error:true})) {
    const result = saveProductCatalog(next);
    if (!result.ok) {
      onFailure();
      return false;
    }
    setProducts(next);
    onCatalogSaved?.(next);
    setFeedback({text:message});
    setDraft(null);
    setRestore(false);
    return true;
  }

  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!entry) return;
    try {
      const next = addProductFromTemplate(products, entry);
      const created = next.at(-1);
      if (!created || !persist(next, `已新增 ${created.name}，仅保存在此浏览器。`, () => setEntryError(SAVE_ERROR))) return;
      setQuery('');
      setCategory(undefined);
      setSelection(created.sku);
      setEntry(null);
      setEntryError('');
      headerActions.current?.querySelector<HTMLButtonElement>('[data-catalog-add]')?.focus();
    } catch (error) {
      setEntryError(error instanceof Error ? error.message : '未新增。请检查商品信息后重试。');
    }
  }

  function closeEntry() {
    setEntry(null);
    setEntryError('');
    headerActions.current?.querySelector<HTMLButtonElement>('[data-catalog-add]')?.focus();
  }

  function changeEntry(field: keyof ProductEntry, value: string) {
    setEntry(previous => previous && {...previous, [field]:value});
    setEntryError('');
  }

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected || !draft) return;
    const next = {name:draft.name.trim(), specification:draft.specification.trim(), notes:draft.notes.trim()};
    if (!next.name || !next.specification) {
      setFeedback({text:'商品名称和规格不能为空。', error:true});
      return;
    }
    try {
      const updated = updateProductMetadata(products, selected.sku, next);
      const item = updated.find(product => product.sku === selected.sku);
      if (item?.name !== next.name || item.specification !== next.specification || item.notes !== next.notes) {
        setFeedback({text:'未保存。请移除不支持的控制字符，或缩短文字后重试。',error:true});
        return;
      }
      persist(updated, '目录信息已保存到此浏览器。');
    }
    catch { setFeedback({text:'未保存。请检查商品名称、规格与备注。', error:true}); }
  }

  function clearInteraction() {
    setDraft(null);
    setRestore(false);
  }

  return <section className="pc-view" aria-label="商品目录">
    <div className="pc-inner">
      <header className="pc-header">
        <div><p className="pc-kicker">YH TWINOPS / 陈列资料</p><h2>商品目录</h2>
          <p>浏览商品模型、参考规格与陈列关系，也可登记自己的示意商品。</p></div>
        <div className="pc-actions" ref={headerActions}><span className="pc-badge">示意数据 · 非库存</span>
          <Button onClick={() => {
            try { downloadCatalog(products); setFeedback({text:'已请求下载目录 JSON。'}); }
            catch { setFeedback({text:'此浏览器未能导出目录。',error:true}); }
          }}><Download size={14} aria-hidden="true"/>导出 JSON</Button>
          <Button variant="quiet" onClick={() => {setEntry(null); setEntryError(''); setDraft(null); setRestore(true);}}>恢复原版</Button>
          <Button data-catalog-add="" variant="accent" aria-expanded={entering} onClick={() => {
            if (entering) { closeEntry(); return; }
            setDraft(null); setRestore(false); setFeedback(null); setEntryError(''); setEntry(emptyEntry());
          }}><Plus size={15} aria-hidden="true"/>新增商品</Button>
        </div>
      </header>
      <aside className="pc-notice">
        <strong>{originalCount} 种原创示意商品{products.length > originalCount ? ` · ${products.length - originalCount} 种本机新增` : ''}</strong>
        <span>{trialCounts ? `已关联 ${linkedProducts} 种商品 · ${totalPlacements} 个试换陈列位置` : '试换位置关联暂不可用'}</span>
        <p>登记与编辑仅保存在此浏览器，可导出 JSON 留档。陈列位置数为试换示意，不代表库存。</p>
      </aside>
      {restore && <div className="pc-restore" role="group" aria-label="恢复原版确认">
        <span>将清除本浏览器新增的商品及对原始商品的资料修改。需要留存时，请先导出 JSON。</span>
        <Button variant="primary" onClick={() => persist([...PRODUCT_CATALOG_SEED], '已恢复原始示意目录。')}>确认恢复</Button>
        <Button onClick={() => setRestore(false)}>取消恢复</Button>
      </div>}
      {feedback && <p className="pc-feedback" role={feedback.error ? 'alert' : 'status'} data-error={feedback.error || undefined}>{feedback.text}</p>}
      <div className="pc-grid">
        <section className="pc-list" aria-label="商品浏览">
          <div className="pc-filter">
            <label>搜索商品<input type="search" placeholder="名称、SKU 或模型键" value={query} onChange={e => {setQuery(e.currentTarget.value);clearInteraction();}}/></label>
            <label>分类<select value={category ?? ''} onChange={e => {
              const next = PRODUCT_CATEGORIES.find(item => item === e.currentTarget.value);
              setCategory(next);clearInteraction();
            }}><option value="">全部分类</option>{PRODUCT_CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>
          <p className="pc-count">{visible.length} 项结果</p>
          {visible.length ? <ul className="pc-products">{visible.map(product => <li key={product.sku}>
            <button type="button" aria-pressed={!entering && product.sku === selected?.sku} onClick={() => {setEntry(null);setEntryError('');setSelection(product.sku);clearInteraction();}}>
              <span>{product.name}<small>{product.sku}</small></span><span className="pc-product-trailing"><span className="pc-category">{product.category}</span><ChevronRight size={14} aria-hidden="true"/></span>
            </button>
          </li>)}</ul> : <p className="pc-empty">没有匹配商品，请换一个搜索词或分类。</p>}
        </section>
        <section className="pc-detail" aria-label="商品资料">
          {entry ? <>
            <div className="pc-detail-title"><div><p className="pc-kicker">商品登记</p><h3>新增商品</h3></div><span className="pc-badge">本机目录</span></div>
            <form className="pc-form pc-entry" aria-label="新增商品表单" onSubmit={add}>
              <label>3D 模型模板
                <select ref={templateSelect} required value={entry.templateSku} onChange={e => changeEntry('templateSku', e.currentTarget.value)}>
                  {PRODUCT_CATALOG_SEED.map(item => <option key={item.sku} value={item.sku}>{PRODUCT_MODEL_REGISTRY[item.modelKey].label} · {item.name}</option>)}
                </select>
              </label>
              <div className="pc-template" aria-label="模板继承属性">
                {template && <><strong>{template.category} · {geometryDimensions(template)}</strong><p>{template.temperatureZone} · {zoneSummary(template)}。分类、温区、参考尺寸和覆盖分区由模板确定。</p></>}
              </div>
              <div className="pc-entry-pair">
                <label>商品 SKU <input required maxLength={40} placeholder="例如 YH-LOCAL-001" autoComplete="off" spellCheck={false} value={entry.sku} onChange={e => changeEntry('sku', e.currentTarget.value)}/></label>
                <label>商品名称 <input required maxLength={80} placeholder="例如 海盐原味薯片" value={entry.name} onChange={e => changeEntry('name', e.currentTarget.value)}/></label>
              </div>
              <p>SKU 必须唯一，支持 3–40 位字母、数字、下划线或短横线，以字母或数字开头。</p>
              <label>商品规格 <input required maxLength={200} placeholder="例如 袋装 · 100 g" value={entry.specification} onChange={e => changeEntry('specification', e.currentTarget.value)}/></label>
              <label>商品介绍（可选）<textarea maxLength={1000} rows={3} placeholder="描述包装、品类或陈列用途" value={entry.notes} onChange={e => changeEntry('notes', e.currentTarget.value)}/></label>
              {entryError && <p className="pc-entry-error" role="alert">{entryError}</p>}
              <p>新增商品复用示意模型，仅保存到当前浏览器，可随目录导出。不会新增货架陈列或库存。</p>
              <div className="pc-actions"><Button type="submit" variant="accent">保存商品</Button><Button onClick={closeEntry}>取消新增</Button></div>
            </form>
          </> : !selected ? <p className="pc-empty">请选择要查看的商品。</p> : <>
            <div className="pc-product-hero">
              <ProductModelPreview key={selected.sku} product={selected}/>
              <div className="pc-intro">
                <div className="pc-detail-title"><div><p className="pc-kicker">{selected.sku}</p><h3>{selected.name}</h3></div>
                  {!draft && <Button size="sm" onClick={() => {setSelection(selected.sku);setRestore(false);setDraft(editable(selected));}}><PencilLine size={14} aria-hidden="true"/>编辑资料</Button>}</div>
                <p className="pc-spec-label">商品规格</p>
                <p className="pc-product-spec">{selected.specification}</p>
                <p className="pc-spec-label">商品介绍</p>
                <p className="pc-product-copy">{selected.notes || (selected.templateSku
                  ? '此条目复用已有 3D 模型，仅用于查看商品资料。'
                  : `${selected.category}的示意商品，用于检视包装结构与陈列比例。`)}</p>
                <dl className="pc-fields">
                  <div><dt>参考尺寸（宽 × 高 × 深）</dt><dd>{geometryDimensions(selected)}</dd></div>
                  <div><dt>分类 / 温区</dt><dd>{selected.category} · {selected.temperatureZone}</dd></div>
                  <div><dt>适用分区</dt><dd>{zoneSummary(selected)}</dd></div>
                  <div><dt>三维模型</dt><dd>{PRODUCT_MODEL_REGISTRY[selected.modelKey].label} <code>{selected.modelKey}</code></dd></div>
                </dl>
              </div>
            </div>
            {draft && <form onSubmit={save} className="pc-form pc-edit" aria-label="编辑商品资料">
              <label>商品名称<input required maxLength={80} value={draft.name} onChange={e => setDraft({...draft,name:e.currentTarget.value})}/></label>
              <label>商品规格<input required maxLength={200} value={draft.specification} onChange={e => setDraft({...draft,specification:e.currentTarget.value})}/></label>
              <label>备注<textarea maxLength={1000} rows={3} value={draft.notes} onChange={e => setDraft({...draft,notes:e.currentTarget.value})}/></label>
              <p>SKU、三维模型与参考尺寸不可编辑。保存资料不会改变 3D 模型、陈列位置或库存。</p>
              <div className="pc-actions"><Button type="submit" variant="accent">保存到此浏览器</Button><Button type="button" onClick={() => setDraft(null)}>取消编辑</Button></div>
            </form>}
            {selected.templateSku
              ? <p className="pc-trial-readout">本机新增 · 复用模板 {selected.templateSku}，{trialCounts?.[selected.sku] ? `关联 ${trialCounts[selected.sku]} 个陈列位置（非库存）。` : '尚未关联货架陈列。'}</p>
              : <><p className="pc-trial-readout"><strong>关联试换陈列位置</strong> <span>{trialCounts ? `${trialCounts[selected.sku] ?? 0} 个${trialCounts[selected.sku] ? '' : '（未关联试换位置）'}` : '待关联'}</span></p>
                {fillControls.previewFill && <details className="pc-trial-tools" open>
                  <summary><span>货架陈列试换</span><ChevronDown size={15} aria-hidden="true"/></summary>
                  <SameSkuFillPanel product={selected} {...fillControls}/>
                </details>}
              </>}
            {placementTrial && <PlacementTrialPanel key={selected.sku} product={selected} controls={placementTrial} />}
          </>}
        </section>
      </div>
    </div>
  </section>;
}
