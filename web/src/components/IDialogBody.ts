export interface IDialogBodyProps<TData = undefined> {
    close(): void;
    close(data: TData): void;
}