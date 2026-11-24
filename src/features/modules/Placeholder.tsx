export function Placeholder({ title }: { title: string }) {
  return (
    <p className="muted">
      {title}: содержимое появится с наполнением модуля. Сейчас раздел показывает только каркас.
    </p>
  );
}
