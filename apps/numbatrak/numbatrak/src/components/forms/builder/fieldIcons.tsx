import { CheckSquare, FileText, Hash, List, Mail, Phone, Radio, Type } from "lucide-react";

export function getFieldIcon(type: string): React.ReactElement {
  const iconClass = "w-4 h-4";
  switch (type) {
    case "text":
      return <Type className={iconClass} />;
    case "email":
      return <Mail className={iconClass} />;
    case "phone":
      return <Phone className={iconClass} />;
    case "number":
      return <Hash className={iconClass} />;
    case "textarea":
      return <FileText className={iconClass} />;
    case "select":
      return <List className={iconClass} />;
    case "radio-group":
      return <Radio className={iconClass} />;
    case "order-bump":
      return <CheckSquare className={iconClass} />;
    default:
      return <Type className={iconClass} />;
  }
}
