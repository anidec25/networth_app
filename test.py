import gspread
from google.oauth2.service_account import Credentials
import streamlit as st


scope = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

creds = Credentials.from_service_account_info(
    st.secrets["gcp_service_account"],
    scopes=scope
)

client = gspread.authorize(creds)

print(client.list_spreadsheet_files())
