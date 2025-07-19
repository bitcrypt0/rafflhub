import { toast as sonnerToast, Toaster as Sonner } from "sonner";

const Toaster = ({
  ...props
}) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      {...props} />
  );
}

export { Toaster, sonnerToast as toast }
