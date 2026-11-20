/** Storyline's app-level building blocks (ported 1:1 from the prototype's shared components). */
import * as React from "react";
import { useId, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, FileText, Plus, ShieldCheck, type LucideIcon } from "lucide-react";
import { useStudio } from "@/state/context";
import type { Doc } from "@/state/types";
import { layoutDocument, PAGE_H, PAGE_W, textWidth, type DrawOp } from "@/lib/pdf/layout";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  type ButtonProps,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from "./primitives";

/** Button with an optional trailing icon. */
export function Btn({ children, icon: Icon, ...props }: ButtonProps & { icon?: LucideIcon }) {
  return (
    <Button {...props}>
      {children}
      {Icon && <Icon />}
    </Button>
  );
}

export function IconBtn({ icon: Icon, label, ...props }: ButtonProps & { icon: LucideIcon; label: string }) {
  return (
    <Button variant="outline" size="icon" aria-label={label} title={label} {...props}>
      <Icon />
    </Button>
  );
}

type TextFieldProps = {
  label: React.ReactNode;
  value: string | number | undefined | null;
  onChange: (value: string) => void;
  area?: boolean;
  hint?: React.ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">;

export function TextField({ label, value, onChange, area = false, hint, ...rest }: TextFieldProps) {
  const id = useId();
  const Control = (area ? Textarea : Input) as React.ElementType;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Control
        id={id}
        value={value ?? ""}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        {...rest}
      />
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}

export type PickOption = string | { value: string; label: string };

export function Pick({
  label,
  value,
  onChange,
  options,
}: {
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: PickOption[];
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => {
              const v = typeof option === "string" ? option : option.value;
              return (
                <SelectItem value={v} key={v}>
                  {typeof option === "string" ? option : option.label}
                </SelectItem>
              );
            })}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

/** Segmented single-choice control (used as tabs throughout the app). */
export function Choices<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly T[];
  label: string;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => next && onChange(next as T)}
      aria-label={label}
      className="choices"
    >
      {options.map((option) => (
        <ToggleGroupItem value={option} key={option}>
          {option}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function Notice({
  title,
  children,
  icon: Icon = ShieldCheck,
  tone = "",
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  icon?: LucideIcon;
  tone?: string;
}) {
  return (
    <Alert className={`notice ${tone}`}>
      <Icon />
      <AlertTitle>{title}</AlertTitle>
      {children && <AlertDescription>{children}</AlertDescription>}
    </Alert>
  );
}

export function Blank({
  title,
  children,
  action,
  onAction,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  onAction?: () => void;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <FileText />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
      {action && (
        <Btn onClick={onAction} icon={Plus}>
          {action}
        </Btn>
      )}
    </Empty>
  );
}

export function PageTitle({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {children && <p className="lede">{children}</p>}
      </div>
      {action}
    </div>
  );
}

export function Row({
  icon: Icon = FileText,
  title,
  sub,
  onClick,
  end,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  sub?: React.ReactNode;
  onClick?: () => void;
  end?: React.ReactNode;
}) {
  return (
    <button className="editorial-row" onClick={onClick}>
      <span className="row-icon">
        <Icon />
      </span>
      <span className="row-copy">
        <strong>{title}</strong>
        {sub && <span>{sub}</span>}
      </span>
      {end || <ChevronRight />}
    </button>
  );
}

export function Logo() {
  return (
    <span className="wordmark">
      <svg width="29" height="34" viewBox="0 0 29 34" fill="none" aria-hidden="true">
        <path d="M4 2h13l9 9v21H4V2Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M17 2v10h9M9 19h12M9 24h9" stroke="currentColor" strokeWidth="1.7" />
      </svg>
      storyline<span className="brand-dot">.</span>
    </span>
  );
}

export function Modal({
  title,
  description,
  open,
  onClose,
  children,
  footer,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="story-modal">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description || "Review and update your workspace."}</DialogDescription>
        </DialogHeader>
        <div className="modal-body">{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

/** True when the OS or the user's Storyline setting asks for reduced motion. */
export function useQuietMotion() {
  const { state } = useStudio();
  return !!useReducedMotion() || state.settings.motion;
}

export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const quiet = useQuietMotion();
  return (
    <motion.div
      className={className}
      initial={quiet ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: quiet ? 0 : 0.28, delay: quiet ? 0 : delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function ResumePage({
  page,
  W = PAGE_W,
  H = PAGE_H,
  label,
  highlight = "",
}: {
  page: DrawOp[];
  W?: number;
  H?: number;
  label?: string;
  highlight?: string;
}) {
  return (
    <svg
      className="resume-page"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label || "Resume page"}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={W} height={H} fill="white" />
      {page.map((op, index) =>
        op.type === "line" ? (
          <line x1={op.x1} x2={op.x2} y1={op.y1} y2={op.y2} stroke={op.color} strokeWidth=".65" key={index} />
        ) : op.type === "rect" ? (
          <rect x={op.x} y={op.y} width={op.w} height={op.h} fill={op.color} key={index} />
        ) : (
          <g key={index}>
            {highlight && op.text.toLowerCase().includes(highlight.toLowerCase()) && (
              <rect
                x={op.x - 2}
                y={op.y - op.size}
                width={textWidth(op.text, op.size, op.font) + 4}
                height={op.size * 1.3}
                fill="#d7f47b"
              />
            )}
            <text
              x={op.x}
              y={op.y}
              fontFamily={op.font === "mono" ? "Courier New, monospace" : "Arial, Helvetica, sans-serif"}
              fontSize={op.size}
              fontWeight={op.font === "bold" ? 700 : 400}
              fill={op.color}
              xmlSpace="preserve"
            >
              {op.text}
            </text>
          </g>
        ),
      )}
    </svg>
  );
}

/** Live A4 rendering of a document (all pages, or just the first when `mini`). */
export function Paper({ doc, mini = false, highlight = "" }: { doc: Doc; mini?: boolean; highlight?: string }) {
  const layout = useMemo(() => layoutDocument(doc), [doc]);
  return (
    <div className={mini ? "paper-mini" : "paper-stack"}>
      {(mini ? layout.pages.slice(0, 1) : layout.pages).map((page, index) => (
        <div className="paper-wrap" key={`${doc.template}-${index}`}>
          <ResumePage
            page={page}
            label={`${doc.title}, page ${index + 1} of ${layout.pages.length}`}
            highlight={highlight}
          />
          {!mini && (
            <p className="page-caption">
              {"Page "}
              {index + 1}
              {" of "}
              {layout.pages.length}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
