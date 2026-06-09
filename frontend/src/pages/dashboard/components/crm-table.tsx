import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ContactRecord } from "@/types/ui";
import { ContactTestToggle } from "@/pages/dashboard/components/contact-test-toggle";
import { ContactDeleteDialog } from "@/pages/dashboard/components/contact-delete-dialog";

function readNote(metadata: ContactRecord["metadata"]): string {
  const note = (metadata as Record<string, unknown> | null)?.note;
  return typeof note === "string" && note.trim() ? note : "-";
}

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

export function CrmTable({
  contacts,
  onSetIsTest,
  updatingIsTestId,
  onDeleteContact,
  deletingContactId,
}: {
  contacts: ContactRecord[];
  onSetIsTest: (contactId: string, isTest: boolean) => void | Promise<void>;
  updatingIsTestId: string | null;
  onDeleteContact: (contactId: string) => void | Promise<void>;
  deletingContactId: string | null;
}) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {contacts.map((c) => (
          <article key={c.id} className="card-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{`${c.first_name} ${c.last_name}`.trim() || "Unnamed contact"}</h3>
                <p className="mt-1 truncate text-sm text-muted-foreground">{c.phone}</p>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                {c.has_conversation ? "Contacted" : "New"}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Test</dt>
                <dd className="mt-0.5">
                  <ContactTestToggle
                    checked={c.is_test}
                    disabled={updatingIsTestId === c.id}
                    onChange={(next) => onSetIsTest(c.id, next)}
                  />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Actions</dt>
                <dd className="mt-0.5">
                  <ContactDeleteDialog
                    name={`${c.first_name} ${c.last_name}`.trim() || "this contact"}
                    deleting={deletingContactId === c.id}
                    onDelete={() => onDeleteContact(c.id)}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Task</dt>
                <dd className="mt-0.5">{c.has_task ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Created</dt>
                <dd className="mt-0.5 text-muted-foreground">{formatDate(c.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Additional info</dt>
                <dd className="mt-0.5 break-words">{readNote(c.metadata)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>First name</TableHead>
              <TableHead>Last name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Test</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Has task</TableHead>
              <TableHead>Created at</TableHead>
              <TableHead>Additional info</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.first_name}</TableCell>
                <TableCell>{c.last_name}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>
                  <ContactTestToggle
                    checked={c.is_test}
                    disabled={updatingIsTestId === c.id}
                    onChange={(next) => onSetIsTest(c.id, next)}
                  />
                </TableCell>
                <TableCell>{c.has_conversation ? "Contacted" : "New"}</TableCell>
                <TableCell>{c.has_task ? "Yes" : "No"}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                <TableCell>{readNote(c.metadata)}</TableCell>
                <TableCell className="text-right">
                  <ContactDeleteDialog
                    name={`${c.first_name} ${c.last_name}`.trim() || "this contact"}
                    deleting={deletingContactId === c.id}
                    onDelete={() => onDeleteContact(c.id)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
