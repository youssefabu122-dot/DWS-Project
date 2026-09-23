-- Schema file for creating tables

CREATE TABLE Member (
    member_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL
);

CREATE TABLE Circle (
    circle_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contribution_amount NUMERIC(10,2) NOT NULL
        CHECK (contribution_amount > 0),
    start_date DATE NOT NULL
);

CREATE TABLE Membership (
    member_id INT NOT NULL
        REFERENCES Member(member_id) ON DELETE CASCADE,
    circle_id INT NOT NULL
        REFERENCES Circle(circle_id) ON DELETE CASCADE,
    joined_on DATE NOT NULL,
    PRIMARY KEY (member_id, circle_id)
);

CREATE TABLE Cycle (
    cycle_id SERIAL PRIMARY KEY,
    circle_id INT NOT NULL
        REFERENCES Circle(circle_id) ON DELETE CASCADE,
    seq_no INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    UNIQUE (circle_id, seq_no)
);

CREATE TABLE Contribution (
    contribution_id SERIAL PRIMARY KEY,
    member_id INT NOT NULL
        REFERENCES Member(member_id),
    cycle_id INT NOT NULL
        REFERENCES Cycle(cycle_id),
    UNIQUE (member_id, cycle_id)
);

CREATE TABLE Bid (
    bid_id SERIAL PRIMARY KEY,
    member_id INT NOT NULL
        REFERENCES Member(member_id),
    cycle_id INT NOT NULL
        REFERENCES Cycle(cycle_id),
    discount_rate NUMERIC(5,2) NOT NULL,
    UNIQUE (member_id, cycle_id)
);

-- Use cycle_id as the primary key in Payout to ensure each cycle has only one payout.
CREATE TABLE Payout (
    cycle_id INT PRIMARY KEY
        REFERENCES Cycle(cycle_id),
    member_id INT NOT NULL
        REFERENCES Member(member_id),
    paid_at TIMESTAMP NOT NULL
);

CREATE TABLE DiscountShare (
    share_id SERIAL PRIMARY KEY,
    payout_cycle_id INT NOT NULL
        REFERENCES Payout(cycle_id),
    member_id INT NOT NULL
        REFERENCES Member(member_id),
    amount NUMERIC(10,2) NOT NULL,
    UNIQUE (payout_cycle_id, member_id)
);