from __future__ import annotations

import base64
import logging
from datetime import datetime

import requests
from django.conf import settings

from apps.common.utils import normalize_phone

logger = logging.getLogger(__name__)


class MpesaClient:
    def __init__(self):
        self.config = settings.MPESA
        self.base_url = (
            "https://sandbox.safaricom.co.ke"
            if self.config["ENVIRONMENT"] == "sandbox"
            else "https://api.safaricom.co.ke"
        )

    def stk_push(self, *, phone: str, amount, account_reference: str, transaction_desc: str) -> dict:
        phone = normalize_phone(phone)
        if self.config["SIMULATE"]:
            return {
                "MerchantRequestID": f"SIM-{account_reference}",
                "CheckoutRequestID": f"SIM-CHECKOUT-{account_reference}",
                "ResponseCode": "0",
                "ResponseDescription": "Simulated M-Pesa STK push accepted.",
                "CustomerMessage": "Simulated request accepted.",
            }

        token = self._access_token()
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        password_raw = f"{self.config['SHORTCODE']}{self.config['PASSKEY']}{timestamp}".encode()
        payload = {
            "BusinessShortCode": self.config["SHORTCODE"],
            "Password": base64.b64encode(password_raw).decode(),
            "Timestamp": timestamp,
            "TransactionType": self.config["TRANSACTION_TYPE"],
            "Amount": int(amount),
            "PartyA": phone,
            "PartyB": self.config["SHORTCODE"],
            "PhoneNumber": phone,
            "CallBackURL": self.config["CALLBACK_URL"],
            "AccountReference": account_reference[:12],
            "TransactionDesc": transaction_desc[:120],
        }
        response = requests.post(
            f"{self.base_url}/mpesa/stkpush/v1/processrequest",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        response.raise_for_status()
        logger.info("M-Pesa STK push initiated for %s", account_reference)
        return response.json()

    def _access_token(self) -> str:
        response = requests.get(
            f"{self.base_url}/oauth/v1/generate?grant_type=client_credentials",
            auth=(self.config["CONSUMER_KEY"], self.config["CONSUMER_SECRET"]),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()["access_token"]
