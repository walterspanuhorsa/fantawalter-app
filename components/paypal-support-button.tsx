import type { CSSProperties } from "react";

const PAYPAL_PAYMENT_URL =
  "https://www.paypal.com/ncp/payment/L6SR4ATN4PB7Y";

export default function PayPalSupportButton() {
  return (
    <a
      href={PAYPAL_PAYMENT_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Supporta FantaWalter con PayPal"
      title="Supporta FantaWalter con PayPal"
      style={buttonStyle}
    >
      <span aria-hidden="true" style={paypalMarkStyle}>
        P
      </span>
      <span>Supporta con PayPal</span>
    </a>
  );
}

const buttonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "7px",
  minHeight: "36px",
  padding: "0 14px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#d8a900",
  borderRadius: "7px",
  background: "#ffc439",
  color: "#111820",
  fontSize: "0.86rem",
  fontWeight: 800,
  lineHeight: 1,
  textDecoration: "none",
  whiteSpace: "nowrap",
  cursor: "pointer",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.12)",
};

const paypalMarkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "19px",
  height: "19px",
  borderRadius: "4px",
  background: "#003087",
  color: "#ffffff",
  fontSize: "0.78rem",
  fontStyle: "italic",
  fontWeight: 900,
};
