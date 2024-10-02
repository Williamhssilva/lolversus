import mysql.connector
from mysql.connector import Error
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
import time
from datetime import datetime
import concurrent.futures
import lxml

# Configuração do banco de dados
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Will1407.',
    'database': 'lol_champions',
    'port': 3306
}

def create_table(connection):
    try:
        cursor = connection.cursor()
        
        # SQL para criar a tabela se ela não existir
        create_table_query = """
        CREATE TABLE IF NOT EXISTS tabela_counters (
            id INT AUTO_INCREMENT PRIMARY KEY,
            champion VARCHAR(255),
            counter VARCHAR(255),
            win_rate FLOAT,
            UNIQUE KEY unique_counter (champion, counter)
        )
        """
        
        cursor.execute(create_table_query)
        connection.commit()
        print("Tabela 'tabela_counters' criada ou já existente.")
        
    except Error as e:
        print(f"Erro ao criar tabela: {e}")
    
    finally:
        if cursor:
            cursor.close()

def get_counters(champion_name):
    try:
        service = Service(ChromeDriverManager().install())
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        driver = webdriver.Chrome(service=service, options=options)

        url = f"https://u.gg/lol/champions/{champion_name}/counter"
        driver.get(url)

        wait = WebDriverWait(driver, 10)  # Reduzido de 20 para 10 segundos
        counter_table = wait.until(EC.presence_of_element_located((By.CLASS_NAME, "counters-list")))

        html = driver.page_source
        soup = BeautifulSoup(html, 'lxml')  # Usando lxml em vez de html.parser

        counter_cards = soup.find_all('a', class_='counter-list-card')

        counters = []
        for card in counter_cards[:5]:
            counter_name = card.find('div', class_='champion-name').text.strip()
            win_rate_text = card.find('div', class_='win-rate').text.strip()
            win_rate = float(win_rate_text.rstrip('% WR')) / 100
            counters.append({'champion': champion_name, 'name': counter_name, 'win_rate': win_rate})

        driver.quit()
        return counters
    except Exception as e:
        print(f"Erro ao obter counters para {champion_name}: {e}")
        return []

def insert_counters(connection, counters):
    if not counters:
        return

    try:
        cursor = connection.cursor()
        
        sql = """INSERT INTO tabela_counters 
                 (champion, counter, win_rate) 
                 VALUES (%s, %s, %s)
                 ON DUPLICATE KEY UPDATE win_rate = VALUES(win_rate)"""
        
        cursor.executemany(sql, [(c['champion'], c['name'], c['win_rate']) for c in counters])
        connection.commit()
        
    except Error as e:
        print(f"Erro ao inserir dados no MySQL: {e}")
    
    finally:
        if cursor:
            cursor.close()

def process_champion(champion, connection):
    try:
        print(f"Obtendo counters para {champion}...")
        counters = get_counters(champion)
        if counters:
            insert_counters(connection, counters)
            return None
        else:
            return champion
    except Exception as e:
        print(f"Erro ao processar {champion}: {e}")
        return champion

def main():
    start_time = datetime.now()
    problematic_champions = []

    try:
        connection = mysql.connector.connect(**db_config)
        print("Conexão com o banco de dados estabelecida.")
        
        create_table(connection)
        
        champions = [
            "Bard"
        ]
        
        total_champions = len(champions)
        processed_champions = 0

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            future_to_champion = {executor.submit(process_champion, champion, connection): champion for champion in champions}
            for future in concurrent.futures.as_completed(future_to_champion):
                champion = future_to_champion[future]
                result = future.result()
                if result:
                    problematic_champions.append(result)
                processed_champions += 1
                print(f"Progresso: {processed_champions}/{total_champions} campeões processados")

        end_time = datetime.now()
        total_time = end_time - start_time

        print("\n--- Resumo da Operação ---")
        print(f"Tempo total de execução: {total_time}")
        print(f"Total de campeões processados: {processed_champions}/{total_champions}")
        if problematic_champions:
            print("Campeões com problemas:")
            for champ in problematic_champions:
                print(f"- {champ}")
        else:
            print("Nenhum campeão apresentou problemas.")

        print("Scraping concluído e dados inseridos no banco de dados.")

    except Error as e:
        print(f"Erro ao conectar ao MySQL: {e}")

    finally:
        if 'connection' in locals() and connection.is_connected():
            connection.close()
            print("Conexão com MySQL fechada.")

if __name__ == "__main__":
    main()