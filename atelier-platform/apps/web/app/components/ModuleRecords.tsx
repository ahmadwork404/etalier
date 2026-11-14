"use client";
import type { ReactNode } from "react";
import { LocationVisual } from "./LocationPhoto";
import { RecordVisual } from "./RecordVisual";
import { ServiceVisual } from "./ServiceVisual";
import { EmployeeAvatar } from "./EmployeePhoto";
import {
  RecordActions,
  RecordDialog,
  recordId,
  recordName,
} from "./RecordActions";

export function ModuleRecords({
  kind,
  rows,
  label,
  detail,
  value,
  actions,
  readOnly = false,
  columns,
}: {
  kind: string;
  rows: any[];
  label: string;
  detail: (row: any) => ReactNode;
  value?: (row: any) => ReactNode;
  actions?: (row: any) => ReactNode;
  readOnly?: boolean;
  columns?: { label: string; render: (row: any) => ReactNode }[];
}) {
  const identity = (row: any) => (
    <div className="module-identity">
      {kind === "branches" ? (
        <LocationVisual
          key={row.image_version || "placeholder"}
          location={row}
        />
      ) : kind === "services" ? (
        <ServiceVisual service={row} />
      ) : kind === "employees" ? (
        <EmployeeAvatar employee={row} />
      ) : (
        <RecordVisual
          name={recordName(row, label)}
          kind={kind}
          identity={recordId(row)}
        />
      )}
      <div>
        <strong>{recordName(row, label)}</strong>
        <small>{detail(row)}</small>
      </div>
    </div>
  );
  const controls = (row: any) => (
    <>
      <RecordActions kind={kind} row={row} viewOnly={readOnly} />
      {actions?.(row)}
    </>
  );
  return (
    <>
      <div className="module-table-scroll">
        <table className="module-table">
          <caption className="sr-only">{label} records</caption>
          <thead>
            <tr>
              <th>{label}</th>
              {value && <th>Details</th>}
              {columns?.map((column) => (
                <th key={column.label}>{column.label}</th>
              ))}
              <th className="table-actions-heading">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={recordId(row)}>
                <td>{identity(row)}</td>
                {value && <td className="module-value">{value(row)}</td>}
                {columns?.map((column) => (
                  <td key={column.label}>{column.render(row)}</td>
                ))}
                <td>
                  <div className="module-row-controls">{controls(row)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="module-mobile-cards">
        {rows.map((row) => (
          <article className="module-mobile-card" key={recordId(row)}>
            <div className="module-card-top">
              {identity(row)}
              <RecordActions kind={kind} row={row} viewOnly={readOnly} />
            </div>
            {value && <div className="module-card-value">{value(row)}</div>}
            {columns?.map((column) => (
              <div className="module-card-value" key={column.label}>
                <span>{column.label}</span>
                {column.render(row)}
              </div>
            ))}
            {actions && <div className="module-card-extra">{actions(row)}</div>}
          </article>
        ))}
      </div>
      {!rows.length && (
        <div className="empty module-empty">
          <RecordVisual name={label} kind={kind} />
          <h2>No {label.toLowerCase()} found</h2>
          <p>Add an entry or try a different filter.</p>
        </div>
      )}
      <RecordDialog kind={kind} rows={rows} />
    </>
  );
}
