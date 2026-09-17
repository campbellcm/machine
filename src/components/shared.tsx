"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ArrowUpRight, FileText } from "lucide-react";
import { demoData, type Post, type Teammate } from "@/lib/demo/data";
import { Button } from "./ui/button";
export function Avatar({
  person,
  small = false,
}: {
  person: Teammate;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`avatar ${person.color} ${small ? "avatar-small" : ""}`}
    >
      {person.initials}
    </span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="subtitle">{description}</p>
      </div>
      {children}
    </div>
  );
}
export function Status({ status }: { status: Post["status"] }) {
  return (
    <span className={`status ${status}`}>
      <span />
      {status === "in_review"
        ? "In review"
        : status === "published"
          ? "Published"
          : "Draft"}
    </span>
  );
}
export function PostPreview({
  post,
  children,
}: {
  post: Post;
  children?: React.ReactNode;
}) {
  const person = demoData.teammates.find((t) => t.id === post.userId)!;
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        {children ?? (
          <button className="post-link">
            {post.title}
            <ArrowUpRight size={15} />
          </button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="dialog-top">
            <span className="eyebrow">
              <FileText size={15} />
              Sample post
            </span>
            <Dialog.Close asChild>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Close post preview"
              >
                <X size={19} />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Title className="dialog-title">{post.title}</Dialog.Title>
          <Dialog.Description className="muted">
            A fictional content example. Editing and approval arrive in the
            interview milestone.
          </Dialog.Description>
          <div className="person-line">
            <Avatar person={person} />
            <div>
              <strong>{person.name}</strong>
              <small>{person.title} at Acme</small>
            </div>
            <Status status={post.status} />
          </div>
          <div className="post-body">{post.body}</div>
          <div className="dialog-note">
            Preview only. No content is published or sent to LinkedIn.
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
