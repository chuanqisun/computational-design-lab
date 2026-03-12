declare module "mustache" {
  const Mustache: {
    render(template: string, view: unknown): string;
  };

  export default Mustache;
}
